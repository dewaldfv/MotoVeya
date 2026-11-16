import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ensurePushSubscription, pushPermissionGranted } from '@/lib/pushSubscription';

// Keeps this device's Web Push subscription alive so incoming messages reach
// the rider while the app is minimized or closed. Also relays service-worker
// -> page messages (notification click) into the app's navigation event.
export function usePushNotifications() {
  useEffect(() => {
    let cancelled = false;
    let swMessageHandler = null;

    const claimSubscription = async () => {
      if (cancelled || !pushPermissionGranted()) return;
      // Subscribing requires a signed-in user; skip quietly before login.
      const authed = await base44.auth.isAuthenticated().catch(() => false);
      if (!authed || cancelled) return;
      await ensurePushSubscription();
    };

    const run = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        swMessageHandler = (event) => {
          const d = event && event.data;
          if (!d) return;
          // Deep-link navigation from a tapped push notification.
          if (d.type === 'motoveya:navigate') {
            window.dispatchEvent(
              new CustomEvent('motoveya:navigate', { detail: { url: d.url, conversationId: d.conversationId } })
            );
          }
          // Legacy: message deep-link from in-app notification click.
          if (d.type === 'motogo:open-conversation' && d.conversationId) {
            window.dispatchEvent(
              new CustomEvent('motogo:open-conversation', { detail: { conversationId: d.conversationId } })
            );
          }
        };
        navigator.serviceWorker.addEventListener('message', swMessageHandler);

        // A returning rider may have granted permission after the first launch.
        await claimSubscription();
      } catch (e) {
        // Push is best-effort — never block the app on it.
      }
    };

    run();

    const onEnabled = () => claimSubscription();
    const onVisible = () => {
      if (document.visibilityState === 'visible') claimSubscription();
    };
    const onFocus = () => claimSubscription();

    window.addEventListener('motoveya:notifications-enabled', onEnabled);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener('motoveya:notifications-enabled', onEnabled);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      if (swMessageHandler) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
      }
    };
  }, []);
}