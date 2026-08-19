import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import webpush from 'npm:web-push@3.6.7';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = secrets.get('VAPID_PUBLIC_KEY');
  const privateKey = secrets.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) throw new Error('VAPID keys are not configured');
  webpush.setVapidDetails('mailto:support@motogo.app', publicKey, privateKey);
  vapidConfigured = true;
}

async function pushToUser(svc, userId, payload) {
  if (!userId) return;
  try { ensureVapid(); } catch (e) { console.error('VAPID', e.message); return; }
  const subs = await svc.entities.PushSubscription.list('-created_date', 500).catch(() => []);
  const mine = (subs || []).filter((s) => s.user_id === userId);
  await Promise.all(mine.map((s) => webpush.sendNotification(
    { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
    JSON.stringify(payload)
  ).catch(async (err) => {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await svc.entities.PushSubscription.delete(s.id).catch(() => {});
    }
  })));
}

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

    await pushToUser(svc, creator_id, {
      title,
      body,
      type,
      action_url: '/crowd-clips',
      clipId: clip_id || null,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('crowd-clips-notify error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
