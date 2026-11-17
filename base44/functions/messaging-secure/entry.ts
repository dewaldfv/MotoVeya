import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUsers } from '../../shared/webPush.ts';

async function canAccessConversation(svc, conversation, userId) {
  if (!conversation || !userId) return false;

  // Direct conversations remain protected by the explicit participant list.
  if (!conversation.group_id) {
    return Array.isArray(conversation.participant_ids) && conversation.participant_ids.includes(userId);
  }

  // Group conversations must use CURRENT group membership as the security
  // boundary. participant_ids is only a cached display/notification list.
  try {
    const membership = await svc.entities.GroupMember.filter({
      group_id: conversation.group_id,
      user_id: userId,
      status: 'active',
    });
    return Array.isArray(membership) && membership.length > 0;
  } catch (error) {
    console.error('group conversation membership check failed:', error);
    return false;
  }
}

// A conversation is unread for a user when it holds a real message from someone
// else that arrived after that user last opened the thread.
function isConversationUnread(conv, userId, lastReadAt) {
  if (!conv?.last_message_preview) return false;
  if (!conv.last_message_at || !conv.last_sender_id) return false;
  if (conv.last_sender_id === userId) return false;
  if (!lastReadAt) return true;
  return new Date(conv.last_message_at).getTime() > new Date(lastReadAt).getTime();
}

// Returns the caller's active conversations plus the set of those with unread messages.
async function unreadSummary(svc, userId) {
  const [all, reads, hides] = await Promise.all([
    svc.entities.Conversation.list('-last_message_at', 200),
    svc.entities.ConversationRead.filter({ user_id: userId }, '-created_date', 500).catch(() => []),
    svc.entities.ConversationHide.filter({ user_id: userId }, '-created_date', 500).catch(() => []),
  ]);
  const readMap = new Map((reads || []).map((r) => [r.conversation_id, r.last_read_at]));
  // Conversations this user removed from their own inbox are hidden for them only.
  const hiddenIds = new Set((hides || []).map((h) => h.conversation_id));
  const mine = (all || []).filter(
    (c) =>
      Array.isArray(c.participant_ids) &&
      c.participant_ids.includes(userId) &&
      !c.is_archived &&
      !hiddenIds.has(c.id)
  );
  const unreadIds = new Set(
    mine.filter((c) => isConversationUnread(c, userId, readMap.get(c.id))).map((c) => c.id)
  );
  return { mine, unreadIds, total: unreadIds.size };
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
      const { mine, unreadIds, total } = await unreadSummary(svc, user.id);
      const conversations = mine.map((c) => {
        const isGroup = !!c.group_id || (c.participant_ids?.length || 0) > 2;
        const unread = unreadIds.has(c.id);
        if (isGroup) {
          return {
            id: c.id,
            is_group: true,
            group_name: c.group_name || 'Group chat',
            participant_count: c.participant_ids?.length || 0,
            last_message_preview: c.last_message_preview || '',
            last_message_at: c.last_message_at,
            last_sender_id: c.last_sender_id,
            unread,
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
          unread,
        };
      });
      return Response.json({ conversations, unread_total: total });
    }

    // Total number of conversations holding unread messages, used by the
    // Community nav dot/counter and the app-icon badge.
    if (action === 'unread_count') {
      const { total } = await unreadSummary(svc, user.id);
      return Response.json({ total });
    }

    if (action === 'messages') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
      const conv = await svc.entities.Conversation.get(conversation_id);
      if (!conv) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const allowed = await canAccessConversation(svc, conv, user.id);
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const messages =
        (await svc.entities.Message.filter({ conversation_id }, 'created_date', 200)) || [];

      // Loading the thread counts as delivery for every incoming message.
      const now = new Date().toISOString();
      const undelivered = messages.filter((m) => m.sender_id !== user.id && !m.delivered_at);
      if (undelivered.length > 0) {
        await svc.entities.Message.bulkUpdate(
          undelivered.map((m) => ({ id: m.id, delivered_at: now }))
        ).catch((e) => console.error('delivery receipt', e?.message));
        undelivered.forEach((m) => { m.delivered_at = now; });
      }

      return Response.json({ messages });
    }

    if (action === 'send') {
      const { recipient_id, recipient_name, content } = body;
      if (!recipient_id || !content || !content.trim()) {
        return Response.json({ error: 'Missing recipient_id or content' }, { status: 400 });
      }
      if (recipient_id === user.id) {
        return Response.json({ error: 'Cannot message yourself' }, { status: 400 });
      }

      // The recipient must be a real app user, otherwise the conversation would
      // be delivered to an inbox nobody can open.
      const recipientUser = await svc.entities.User.get(recipient_id).catch(() => null);
      if (!recipientUser) {
        return Response.json({ error: 'This contact cannot receive messages yet' }, { status: 404 });
      }

      const key = [user.id, recipient_id].sort().join('_');
      const existing = await svc.entities.Conversation.filter({ conversation_key: key });
      let conv = existing[0];
      const preview = content.trim().substring(0, 120);
      const now = new Date().toISOString();

      const sortedParticipants = [
        { id: user.id, name: user.full_name || 'Rider' },
        { id: recipient_id, name: recipient_name || recipientUser.full_name || 'Rider' },
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
          // A new message brings an archived direct chat back into both inboxes.
          is_archived: false,
        });
      }

      const message = await svc.entities.Message.create({
        conversation_id: conv.id,
        sender_id: user.id,
        sender_name: user.full_name || 'Rider',
        content: content.trim(),
      });

      // A new direct message brings a chat hidden by either side back into their inbox.
      await svc.entities.ConversationHide.deleteMany({ conversation_id: conv.id }).catch(() => {});

      await svc.entities.Notification.create({
        type: 'message',
        title: user.full_name || 'Rider',
        body: preview,
        recipient_id: recipient_id,
        conversation_id: conv.id,
        action_url: '/community',
        // message_at identifies this exact message so the app can show a
        // single alert for it across notification and polling paths.
        data: JSON.stringify({ conversation_id: conv.id, sender_id: user.id, message_at: now }),
        is_read: false,
      }).catch(() => {});

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
      if (!conv) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const allowed = await canAccessConversation(svc, conv, user.id);
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

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
          data: JSON.stringify({ conversation_id, sender_id: user.id, is_group: true, message_at: now }),
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
      const now = new Date().toISOString();
      const conv = await svc.entities.Conversation.get(conversation_id).catch(() => null);
      if (!conv) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const allowed = await canAccessConversation(svc, conv, user.id);
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const existing = await svc.entities.ConversationRead.filter({
        conversation_id,
        user_id: user.id,
      });
      if (existing && existing.length > 0) {
        await svc.entities.ConversationRead.update(existing[0].id, {
          last_read_at: now,
          created_by_id: existing[0].created_by_id || user.id,
        });
      } else {
        await svc.entities.ConversationRead.create({
          conversation_id,
          user_id: user.id,
          last_read_at: now,
          created_by_id: user.id,
        });
      }

      await svc.entities.Notification.updateMany(
        { recipient_id: user.id, conversation_id, is_read: false, type: 'message' },
        { $set: { is_read: true } }
      );

      // Opening the thread marks every incoming message as read (and delivered).
      const threadMessages = await svc.entities.Message.filter({ conversation_id }, 'created_date', 200).catch(() => []);
      const unread = (threadMessages || []).filter((m) => m.sender_id !== user.id && (!m.read_at || !m.delivered_at));
      if (unread.length > 0) {
        await svc.entities.Message.bulkUpdate(
          unread.map((m) => ({ id: m.id, read_at: now, delivered_at: m.delivered_at || now }))
        ).catch((e) => console.error('read receipt', e?.message));
      }

      return Response.json({ success: true });
    }

    // Notify the organizer who submitted an event that it was approved or rejected.
    // Only admins/moderators may issue official approval/rejection notices.
    if (action === 'notify_event') {
      if (user.role !== 'admin' && user.role !== 'moderator') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { event_id, status, reason } = body;
      if (!event_id || !status) return Response.json({ error: 'Missing event_id or status' }, { status: 400 });
      const ev = await svc.entities.Event.get(event_id).catch(() => null);
      if (!ev) return Response.json({ error: 'Event not found' }, { status: 404 });
      const organizerId = ev.created_by_id;
      if (!organizerId) return Response.json({ error: 'No organizer for event' }, { status: 400 });

      const isApproved = status === 'approved';
      const title = isApproved ? 'Event Approved 🎉' : 'Event Rejected';
      const notifBody = isApproved
        ? `Your event "${ev.title}" has been approved and is now live on MotoVeya.`
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
          await svc.integrations.Core.SendEmail({
            to: org.email,
            subject: title,
            body: `${notifBody}\n\nView it in MotoVeya under the Events tab.\n\n— The MotoVeya Team`,
          });
        }
      } catch (e) { console.error('event email', e.message); }

      return Response.json({ success: true });
    }

    // Notify the user who submitted a service that it was approved or rejected.
    // Only admins/moderators may issue official approval/rejection notices.
    if (action === 'notify_service') {
      if (user.role !== 'admin' && user.role !== 'moderator') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { service_id, status, reason } = body;
      if (!service_id || !status) return Response.json({ error: 'Missing service_id or status' }, { status: 400 });
      const serviceRec = await svc.entities.Service.get(service_id).catch(() => null);
      if (!serviceRec) return Response.json({ error: 'Service not found' }, { status: 404 });
      const submitterId = serviceRec.created_by_id;
      if (!submitterId) return Response.json({ error: 'No submitter for service' }, { status: 400 });

      const isApproved = status === 'approved';
      const title = isApproved ? 'Service Approved 🎉' : 'Service Rejected';
      const notifBody = isApproved
        ? `Your service "${serviceRec.name}" has been approved and is now listed on MotoVeya.`
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
          await svc.integrations.Core.SendEmail({
            to: sub.email,
            subject: title,
            body: `${notifBody}\n\nView it in MotoVeya under Community → Services.\n\n— The MotoVeya Team`,
          });
        }
      } catch (e) { console.error('service email', e.message); }

      return Response.json({ success: true });
    }

    // Tells the person who submitted an event or service listing that an admin
    // removed it, including the reason. An in-app notification only.
    if (action === 'notify_removal') {
      if (user.role !== 'admin' && user.role !== 'moderator') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { kind, record_id, reason } = body;
      if (!record_id || !reason || !reason.trim()) {
        return Response.json({ error: 'Missing record_id or reason' }, { status: 400 });
      }
      const isService = kind === 'service';
      const rec = isService
        ? await svc.entities.Service.get(record_id).catch(() => null)
        : await svc.entities.Event.get(record_id).catch(() => null);
      if (!rec) return Response.json({ error: 'Record not found' }, { status: 404 });
      const recipientId = isService ? (rec.provider_id || rec.created_by_id) : rec.created_by_id;
      if (!recipientId) return Response.json({ error: 'No submitter for this record' }, { status: 400 });

      const name = isService ? rec.name : rec.title;
      const notifBody = `Your ${isService ? 'service listing' : 'event'} "${name}" was removed by a MotoVeya admin. Reason: ${reason.trim()}`;

      await svc.entities.Notification.create({
        type: 'removal_notice',
        title: isService ? 'Service Listing Removed' : 'Event Removed',
        body: notifBody,
        recipient_id: recipientId,
        is_read: false,
        data: JSON.stringify(isService ? { service_id: rec.id, reason: reason.trim() } : { event_id: rec.id, reason: reason.trim() }),
        action_url: isService ? '/community' : '/events',
      });

      return Response.json({ success: true, recipient_id: recipientId });
    }

    if (action === 'archive_conversation') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
      const conv = await svc.entities.Conversation.get(conversation_id);
      if (!conv) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const allowed = await canAccessConversation(svc, conv, user.id);
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
      await svc.entities.Conversation.update(conversation_id, { is_archived: true });
      return Response.json({ success: true });
    }

    // Removes the chat from the caller's own inbox only — the conversation and its
    // messages stay intact for everybody else, including groups the caller has left.
    if (action === 'hide_conversation') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });

      const existing = await svc.entities.ConversationHide.filter({
        conversation_id,
        user_id: user.id,
      });
      if (!existing || existing.length === 0) {
        await svc.entities.ConversationHide.create({
          conversation_id,
          user_id: user.id,
          created_by_id: user.id,
        });
      }
      return Response.json({ success: true });
    }

    if (action === 'delete_conversation') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
      const conv = await svc.entities.Conversation.get(conversation_id).catch(() => null);
      // Already gone (e.g. removed on another device) — treat as a successful delete.
      if (!conv) return Response.json({ success: true, already_deleted: true });
      const allowed = await canAccessConversation(svc, conv, user.id);
      if (!allowed) {
        return Response.json({ error: 'You no longer have access to this chat' }, { status: 403 });
      }

      // Clear the messages in one batch so long group threads don't time out.
      await svc.entities.Message.deleteMany({ conversation_id }).catch((e) => {
        console.error('message cleanup failed', e?.message);
      });
      await svc.entities.ConversationRead.deleteMany({ conversation_id }).catch(() => {});
      await svc.entities.Notification.deleteMany({ conversation_id }).catch(() => {});

      try {
        await svc.entities.Conversation.delete(conversation_id);
      } catch (e) {
        const gone = await svc.entities.Conversation.get(conversation_id).catch(() => null);
        if (gone) throw e;
      }
      return Response.json({ success: true });
    }

    // Send a ride invite (push + in-app notification) to accepted friends.
    if (action === 'notify_ride_invite') {
      const { recipient_ids, title, body: inviteBody, data, action_url } = body || {};
      const ids = Array.isArray(recipient_ids) ? recipient_ids.filter(Boolean) : [];
      if (ids.length === 0) return Response.json({ error: 'No recipients' }, { status: 400 });

      // Only notify accepted friends of the caller.
      const [asReq, asRec] = await Promise.all([
        svc.entities.Friend.filter({ requester_id: user.id, status: 'accepted' }, '-created_date', 200),
        svc.entities.Friend.filter({ recipient_id: user.id, status: 'accepted' }, '-created_date', 200),
      ]);
      const accepted = new Set([
        ...(asReq || []).map((f) => f.recipient_id),
        ...(asRec || []).map((f) => f.requester_id),
      ]);
      const allowed = ids.filter((id) => accepted.has(id));
      if (allowed.length === 0) return Response.json({ sent: 0 });

      const notifTitle = title || 'Ride invite';
      const notifBody = inviteBody || '';
      const dataStr = JSON.stringify(data || {});
      const url = action_url || '/community';
      await svc.entities.Notification.bulkCreate(
        allowed.map((recipient_id) => ({
          type: 'ride_invite',
          title: notifTitle,
          body: notifBody,
          recipient_id,
          data: dataStr,
          action_url: url,
          is_read: false,
        }))
      ).catch(() => {});

      try {
        await sendPushToUsers(svc, allowed, {
          title: notifTitle,
          body: notifBody,
          type: 'ride_invite',
          action_url: url,
          ...(data || {}),
        });
      } catch (e) { console.error('ride invite push', e.message); }

      return Response.json({ sent: allowed.length });
    }

    // Notify a rider of a new friend request (push + in-app notification).
    if (action === 'notify_friend_request') {
      const { recipient_id } = body || {};
      if (!recipient_id) return Response.json({ error: 'Missing recipient_id' }, { status: 400 });
      if (recipient_id === user.id) return Response.json({ error: 'Cannot friend yourself' }, { status: 400 });

      // Confirm a pending friend request from the caller exists.
      const fr = await svc.entities.Friend.filter({ requester_id: user.id, recipient_id, status: 'pending' });
      if (!fr || fr.length === 0) return Response.json({ error: 'No pending request' }, { status: 400 });

      const requesterName = user.full_name || 'A rider';
      const notifTitle = 'Friend Request';
      const notifBody = `${requesterName} wants to connect with you on MotoVeya.`;
      await svc.entities.Notification.create({
        type: 'friend_request',
        title: notifTitle,
        body: notifBody,
        recipient_id,
        is_read: false,
        data: JSON.stringify({ requester_id: user.id, requester_name: requesterName }),
        action_url: '/community',
      }).catch(() => {});

      try {
        await sendPushToUsers(svc, [recipient_id], {
          title: notifTitle,
          body: notifBody,
          type: 'friend_request',
          action_url: '/community',
        });
      } catch (e) { console.error('friend request push', e.message); }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('messaging-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});