import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('messaging-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});