import { base44 } from '@/api/base44Client';

/**
 * Opens a private chat with an event organizer or service provider.
 * The conversation itself is created by the messaging backend on the first message.
 */
export async function messageContact(navigate, userId, fallbackName = 'Rider') {
  if (!userId) return;
  let name = fallbackName;
  try {
    const res = await base44.functions.invoke('get-contact-card', { user_id: userId });
    name = res.data?.name || fallbackName;
  } catch (e) {
    console.error('contact name lookup failed', e);
  }
  navigate('/community', {
    state: {
      tab: 'messages',
      initialConversation: { other_participant_id: userId, other_participant_name: name },
    },
  });
}