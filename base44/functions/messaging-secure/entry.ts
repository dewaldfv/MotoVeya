import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import webpush from 'npm:web-push@3.6.7';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = secrets.get('VAPID_PUBLIC_KEY');
  const privateKey = secrets.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set');
  }
  webpush.setVapidDetails('mailto:support@motogo.app', publicKey, privateKey);
  vapidConfigured = true;
}

// Send a Web Push notification to every stored subscription owned by the
// given user ids. `svc` is a base44 service-role client (bypasses RLS so we
// can read other users' subscriptions). Expired/invalid subscriptions are
// pruned automatically.
async function sendPushToUsers(svc, userIds, payload) {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return { sent: 0 };
  try {
    ensureVapid();
  } catch (e) {
    console.error('webPush ensureVapid', e.message);
    return { sent: 0, error: e.message };
  }
  let subs = [];
  try {
    subs = await svc.entities.PushSubscription.list('-created_date', 500);
  } catch (e) {
    console.error('webPush list subs', e.message);
    return { sent: 0, error: e.message };
  }
  const idSet = new Set(ids);
  const mine = (subs || []).filter((s) => idSet.has(s.user_id));
  if (mine.length === 0) return { sent: 0 };
  const payloadStr = JSON.stringify(payload || {});
  let sent = 0;
  await Promise.all(
    mine.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
          payloadStr
        )
        .then(() => { sent += 1; })
        .catch(async (err) => {
          const status = err && err.statusCode;
          if (status === 404 || status === 410) {
            try { await svc.entities.PushSubscription.delete(s.id); } catch (e) {}
          }
        })
    )
  );
  return { sent };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'conversations') {
      const all = await svc.entities.Conversation.list('-last_message_at', 200);
      const mine = (all || []).filter(
        (c) => Array.isArray(c.participant_ids) && c.participant_ids.includes(user.id)
      );
      const conversations = mine.map((c) => {
        const isGroup = !!c.group_id || (c.participant_ids?.length || 0) > 2;
        if (isGroup) {
          return {
            id: c.id,
            is_group: true,
            group_name: c.group_name || 'Group chat',
            participant_count: c.participant_ids?.length || 0,
            last_message_preview: c.last_message_preview || '',
            last_message_at: c.last_message_at,
            last_sender_id: c.last_sender_id,
          };
        }
        const otherIdx = c.participant_ids[0] === user.id ? 1 : 0;
        return {
          id: c.id,
          is_group: false,
          other_participant_id: c.participant_ids[otherIdx],
          other_participant_name: c.participant_names?.[otherIdx] || 'Rider',
          last_message_preview: c.last_message_preview || '',
          last_message_at: c.last_message_at,
          last_sender_id: c.last_sender_id,
        };
      });
      return Response.json({ conversations });
    }

    if (action === 'messages') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
      const conv = await svc.entities.Conversation.get(conversation_id);
      if (!conv || !Array.isArray(conv.participant_ids) || !conv.participant_ids.includes(user.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const messages = await svc.entities.Message.filter(
        { conversation_id },
        'created_date',
        200
      );
      return Response.json({ messages: messages || [] });
    }

    if (action === 'send') {
      const { recipient_id, recipient_name, content } = body;
      if (!recipient_id || !content || !content.trim()) {
        return Response.json({ error: 'Missing recipient_id or content' }, { status: 400 });
      }
      if (recipient_id === user.id) {
        return Response.json({ error: 'Cannot message yourself' }, { status: 400 });
      }

      const key = [user.id, recipient_id].sort().join('_');
      const existing = await svc.entities.Conversation.filter({ conversation_key: key });
      let conv = existing[0];
      const preview = content.trim().substring(0, 120);
      const now = new Date().toISOString();

      const sortedParticipants = [
        { id: user.id, name: user.full_name || 'Rider' },
        { id: recipient_id, name: recipient_name || 'Rider' },
      ].sort((a, b) => a.id.localeCompare(b.id));

      if (!conv) {
        conv = await svc.entities.Conversation.create({
          conversation_key: key,
          participant_ids: sortedParticipants.map((p) => p.id),
          participant_names: sortedParticipants.map((p) => p.name),
          last_message_preview: preview,
          last_message_at: now,
          last_sender_id: user.id,
        });
      } else {
        conv = await svc.entities.Conversation.update(conv.id, {
          last_message_preview: preview,
          last_message_at: now,
          last_sender_id: user.id,
        });
      }

      const message = await svc.entities.Message.create({
        conversation_id: conv.id,
        sender_id: user.id,
        sender_name: user.full_name || 'Rider',
        content: content.trim(),
      });

      await svc.entities.Notification.create({
        type: 'message',
        title: user.full_name || 'Rider',
        body: preview,
        recipient_id: recipient_id,
        conversation_id: conv.id,
        data: JSON.stringify({ conversation_id: conv.id, sender_id: user.id }),
        is_read: false,
      });

      try {
        await sendPushToUsers(svc, [recipient_id], {
          title: user.full_name || 'Rider',
          body: preview,
          conversationId: conv.id,
          isGroup: false,
        });
      } catch (e) {
        console.error('push send', e.message);
      }

      return Response.json({ message, conversation_id: conv.id });
    }

    if (action === 'start_group') {
      const { group_id } = body;
      if (!group_id) return Response.json({ error: 'Missing group_id' }, { status: 400 });

      // Verify the caller is an active member of this group.
      const myMembership = await svc.entities.GroupMember.filter({ group_id, user_id: user.id, status: 'active' });
      if (!myMembership || myMembership.length === 0) {
        return Response.json({ error: 'Not a member of this group' }, { status: 403 });
      }

      const group = await svc.entities.Group.get(group_id).catch(() => null);
      const members = await svc.entities.GroupMember.filter({ group_id, status: 'active' }, '-created_date', 50);
      const participant_ids = (members || []).map((m) => m.user_id).filter(Boolean);
      const participant_names = (members || []).map((m) => m.user_name || m.user_nickname || 'Rider');

      const key = `group_${group_id}`;
      const existing = await svc.entities.Conversation.filter({ conversation_key: key });
      let conv = existing[0];
      if (!conv) {
        conv = await svc.entities.Conversation.create({
          conversation_key: key,
          participant_ids,
          participant_names,
          group_id,
          group_name: group?.name || 'Group chat',
          last_message_preview: '',
          last_message_at: new Date().toISOString(),
          last_sender_id: user.id,
        });
      } else {
        // Keep the participant list fresh in case members joined/left.
        conv = await svc.entities.Conversation.update(conv.id, {
          participant_ids,
          participant_names,
          group_name: group?.name || conv.group_name || 'Group chat',
        });
      }

      return Response.json({
        conversation_id: conv.id,
        group_name: conv.group_name,
        participant_count: participant_ids.length,
      });
    }

    if (action === 'send_group') {
      const { conversation_id, content } = body;
      if (!conversation_id || !content || !content.trim()) {
        return Response.json({ error: 'Missing conversation_id or content' }, { status: 400 });
      }
      const conv = await svc.entities.Conversation.get(conversation_id);
      if (!conv || !Array.isArray(conv.participant_ids) || !conv.participant_ids.includes(user.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const preview = content.trim().substring(0, 120);
      const now = new Date().toISOString();
      await svc.entities.Conversation.update(conversation_id, {
        last_message_preview: preview,
        last_message_at: now,
        last_sender_id: user.id,
      });

      const message = await svc.entities.Message.create({
        conversation_id,
        sender_id: user.id,
        sender_name: user.full_name || 'Rider',
        content: content.trim(),
      });

      // Notify every other participant.
      const others = (conv.participant_ids || []).filter((id) => id !== user.id);
      for (const rid of others) {
        await svc.entities.Notification.create({
          type: 'message',
          title: user.full_name || 'Rider',
          body: preview,
          recipient_id: rid,
          conversation_id,
          data: JSON.stringify({ conversation_id, sender_id: user.id, is_group: true }),
          is_read: false,
        }).catch(() => {});
      }

      try {
        await sendPushToUsers(svc, others, {
          title: conv.group_name || 'Group chat',
          body: `${user.full_name || 'Rider'}: ${preview}`,
          conversationId,
          isGroup: true,
        });
      } catch (e) {
        console.error('push send group', e.message);
      }

      return Response.json({ message, conversation_id });
    }

    if (action === 'mark_read') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
      await svc.entities.Notification.updateMany(
        { recipient_id: user.id, conversation_id, is_read: false, type: 'message' },
        { $set: { is_read: true } }
      );
      return Response.json({ success: true });
    }

    // Notify the organizer who submitted an event that it was approved or rejected.
    if (action === 'notify_event') {
      const { event_id, status, reason } = body;
      if (!event_id || !status) return Response.json({ error: 'Missing event_id or status' }, { status: 400 });
      const ev = await svc.entities.Event.get(event_id).catch(() => null);
      if (!ev) return Response.json({ error: 'Event not found' }, { status: 404 });
      const organizerId = ev.created_by_id;
      if (!organizerId) return Response.json({ error: 'No organizer for event' }, { status: 400 });

      const isApproved = status === 'approved';
      const title = isApproved ? 'Event Approved 🎉' : 'Event Rejected';
      const notifBody = isApproved
        ? `Your event "${ev.title}" has been approved and is now live on MotoGo.`
        : `Your event "${ev.title}" was denied${reason ? `. Reason: ${reason}` : '.'}`;

      await svc.entities.Notification.create({
        type: 'event_reminder',
        title,
        body: notifBody,
        recipient_id: organizerId,
        is_read: false,
        data: JSON.stringify({ event_id: ev.id, status }),
        action_url: `/events/${ev.id}`,
      }).catch(() => {});

      try {
        await sendPushToUsers(svc, [organizerId], {
          title,
          body: notifBody,
          eventId: ev.id,
        });
      } catch (e) { console.error('event push', e.message); }

      try {
        const org = await svc.entities.User.get(organizerId).catch(() => null);
        if (org?.email) {
          await base44.integrations.Core.SendEmail({
            to: org.email,
            subject: title,
            body: `${notifBody}\n\nView it in MotoGo under the Events tab.\n\n— The MotoGo Team`,
          });
        }
      } catch (e) { console.error('event email', e.message); }

      return Response.json({ success: true });
    }

    // Notify the user who submitted a service that it was approved or rejected.
    if (action === 'notify_service') {
      const { service_id, status, reason } = body;
      if (!service_id || !status) return Response.json({ error: 'Missing service_id or status' }, { status: 400 });
      const serviceRec = await svc.entities.Service.get(service_id).catch(() => null);
      if (!serviceRec) return Response.json({ error: 'Service not found' }, { status: 404 });
      const submitterId = serviceRec.created_by_id;
      if (!submitterId) return Response.json({ error: 'No submitter for service' }, { status: 400 });

      const isApproved = status === 'approved';
      const title = isApproved ? 'Service Approved 🎉' : 'Service Rejected';
      const notifBody = isApproved
        ? `Your service "${serviceRec.name}" has been approved and is now listed on MotoGo.`
        : `Your service "${serviceRec.name}" was denied${reason ? `. Reason: ${reason}` : '.'}`;

      await svc.entities.Notification.create({
        type: 'event_reminder',
        title,
        body: notifBody,
        recipient_id: submitterId,
        is_read: false,
        data: JSON.stringify({ service_id: serviceRec.id, status }),
        action_url: '/community',
      }).catch(() => {});

      try {
        await sendPushToUsers(svc, [submitterId], {
          title,
          body: notifBody,
        });
      } catch (e) { console.error('service push', e.message); }

      try {
        const sub = await svc.entities.User.get(submitterId).catch(() => null);
        if (sub?.email) {
          await base44.integrations.Core.SendEmail({
            to: sub.email,
            subject: title,
            body: `${notifBody}\n\nView it in MotoGo under Community → Services.\n\n— The MotoGo Team`,
          });
        }
      } catch (e) { console.error('service email', e.message); }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('messaging-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});