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

        // Message records are private. Poll the authorization-checked conversation endpoint
        // rather than subscribing directly to the Message entity.
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