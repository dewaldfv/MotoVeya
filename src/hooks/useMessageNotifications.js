import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  requestNotificationPermission,
  showMessageNotification,
  getActiveConversationId,
} from '@/lib/messageNotifications';

// Fires OS-level notifications for incoming messages the user is not
// currently viewing. Mounted once at the app layout level (post-auth).
export function useMessageNotifications() {
  // conversation id -> timestamp of the last message already seen on this device
  const lastSeenRef = useRef(null);
  const myIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let interval;

    const refresh = async () => {
      try {
        const res = await base44.functions.invoke('messaging-secure', { action: 'conversations' });
        if (!mounted) return;
        const convs = res?.data?.conversations || [];

        // The first sweep only records what already exists.
        const previous = lastSeenRef.current;
        lastSeenRef.current = new Map(convs.map((c) => [c.id, c.last_message_at || null]));
        if (!previous) return;

        convs.forEach((c) => {
          if (!c.last_message_at || !c.last_sender_id) return;
          if (c.last_sender_id === myIdRef.current) return;
          if (!c.last_message_preview) return;

          const seenAt = previous.get(c.id);
          if (seenAt && new Date(c.last_message_at).getTime() <= new Date(seenAt).getTime()) return;
          // Already reading this thread — no banner needed.
          if (getActiveConversationId() === c.id) return;

          const title = c.is_group ? c.group_name || 'Group chat' : c.other_participant_name || 'Rider';
          const body = c.last_message_preview;

          showMessageNotification({ title, body, conversationId: c.id });
          window.dispatchEvent(
            new CustomEvent('motoveya:message-popup', {
              detail: {
                id: `${c.id}_${c.last_message_at}`,
                title,
                body,
                conversationId: c.id,
              },
            })
          );
        });
      } catch (e) {
        /* ignore */
      }
    };

    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed || !mounted) return;
        const me = await base44.auth.me();
        if (!mounted) return;
        myIdRef.current = me.id;

        await requestNotificationPermission();
        if (!mounted) return;

        await refresh();
        interval = setInterval(refresh, 10000);

        // Message records are private. Poll the authorization-checked conversation endpoint
        // rather than subscribing directly to the Message entity.
      } catch (e) {
        /* ignore */
      }
    })();

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);
}