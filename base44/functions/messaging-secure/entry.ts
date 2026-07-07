import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'conversations') {
      const all = await base44.asServiceRole.entities.Conversation.list('-last_message_at', 200);
      const mine = (all || []).filter(
        (c) => Array.isArray(c.participant_ids) && c.participant_ids.includes(user.id)
      );
      const conversations = mine.map((c) => {
        const otherIdx = c.participant_ids[0] === user.id ? 1 : 0;
        return {
          id: c.id,
          other_participant_id: c.participant_ids[otherIdx],
          other_participant_name: c.participant_names?.[otherIdx] || 'Rider',
          last_message_preview: c.last_message_preview || '',
          last_message_at: c.last_message_at,
          last_sender_id: c.last_sender_id,
          group_ride_id: c.group_ride_id,
        };
      });
      return Response.json({ conversations });
    }

    if (action === 'messages') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
      const conv = await base44.asServiceRole.entities.Conversation.get(conversation_id);
      if (!conv || !Array.isArray(conv.participant_ids) || !conv.participant_ids.includes(user.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const messages = await base44.asServiceRole.entities.Message.filter(
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
      const existing = await base44.asServiceRole.entities.Conversation.filter({ conversation_key: key });
      let conv = existing[0];
      const preview = content.trim().substring(0, 120);
      const now = new Date().toISOString();

      const sortedParticipants = [
        { id: user.id, name: user.full_name || 'Rider' },
        { id: recipient_id, name: recipient_name || 'Rider' },
      ].sort((a, b) => a.id.localeCompare(b.id));

      if (!conv) {
        conv = await base44.asServiceRole.entities.Conversation.create({
          conversation_key: key,
          participant_ids: sortedParticipants.map((p) => p.id),
          participant_names: sortedParticipants.map((p) => p.name),
          last_message_preview: preview,
          last_message_at: now,
          last_sender_id: user.id,
        });
      } else {
        conv = await base44.asServiceRole.entities.Conversation.update(conv.id, {
          last_message_preview: preview,
          last_message_at: now,
          last_sender_id: user.id,
        });
      }

      const message = await base44.asServiceRole.entities.Message.create({
        conversation_id: conv.id,
        sender_id: user.id,
        sender_name: user.full_name || 'Rider',
        content: content.trim(),
      });

      await base44.asServiceRole.entities.Notification.create({
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

    if (action === 'mark_read') {
      const { conversation_id } = body;
      if (!conversation_id) return Response.json({ error: 'Missing conversation_id' }, { status: 400 });
      await base44.asServiceRole.entities.Notification.updateMany(
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