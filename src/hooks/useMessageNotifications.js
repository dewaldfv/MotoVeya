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
  const convSetRef = useRef(new Set());
  const convMetaRef = useRef({});

  useEffect(() => {
    let mounted = true;
    let interval;
    let unsub = () => {};

    const refresh = async () => {
      try {
        const res = await base44.functions.invoke('messaging-secure', { action: 'conversations' });
        if (!mounted) return;
        const convs = res?.data?.conversations || [];
        convSetRef.current = new Set(convs.map((c) => c.id));
        convMetaRef.current = Object.fromEntries(
          convs.map((c) => [
            c.id,
            {
              name: c.is_group ? c.group_name : c.other_participant_name,
              is_group: !!c.is_group,
            },
          ])
        );
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

        await requestNotificationPermission();
        if (!mounted) return;

        await refresh();
        interval = setInterval(refresh, 20000);

        unsub = base44.entities.Message.subscribe((event) => {
          if (event.type !== 'create' && event.type !== 'update') return;
          const m = event.data;
          if (!m || !m.conversation_id || !m.sender_id) return;
          if (m.sender_id === me.id) return;
          if (!convSetRef.current.has(m.conversation_id)) return;
          if (getActiveConversationId() === m.conversation_id) return;

          const meta = convMetaRef.current[m.conversation_id] || {};
          const title = meta.is_group ? meta.name || 'Group chat' : m.sender_name || 'New message';
          const body = (meta.is_group && m.sender_name ? `${m.sender_name}: ` : '') + (m.content || '');
          showMessageNotification({ title, body, conversationId: m.conversation_id });

          refresh();
        });
      } catch (e) {
        /* ignore */
      }
    })();

    return () => {
      mounted = false;
      clearInterval(interval);
      unsub();
    };
  }, []);
}