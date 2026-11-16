import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUsers } from '../../shared/webPush.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const { action, clip_id, creator_id, clip_caption } = await req.json().catch(() => ({}));

    if (!['like', 'comment', 'follow'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (!creator_id) return Response.json({ error: 'Missing creator_id' }, { status: 400 });
    if (creator_id === user.id) return Response.json({ success: true, sent: 0 });

    const actorName = user.full_name || user.nickname || 'A rider';
    let title = '';
    let body = '';
    let type = '';

    if (action === 'like') {
      title = '❤️ New Like';
      body = `${actorName} liked your Crowd Clip${clip_caption ? `: ${clip_caption.slice(0, 70)}` : '.'}`;
      type = 'crowd_clip_like';
    } else if (action === 'comment') {
      title = '💬 New Comment';
      body = `${actorName} commented on your Crowd Clip.`;
      type = 'crowd_clip_comment';
    } else {
      title = '👤 New Follower';
      body = `${actorName} started following you on MotoVeya.`;
      type = 'crowd_clip_follow';
    }

    await svc.entities.Notification.create({
      type,
      title,
      body,
      recipient_id: creator_id,
      is_read: false,
      data: JSON.stringify({ clip_id, actor_id: user.id, type }),
      action_url: clip_id ? '/crowd-clips' : '/crowd-clips',
    }).catch((e) => console.error('in-app notification', e.message));

    await sendPushToUsers(svc, [creator_id], {
      title,
      body,
      type,
      action_url: '/crowd-clips',
      clipId: clip_id || null,
    }).catch((e) => console.error('crowd clip push', e.message));

    return Response.json({ success: true });
  } catch (error) {
    console.error('crowd-clips-notify error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});