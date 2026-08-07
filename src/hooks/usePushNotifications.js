import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Converts the base64url VAPID public key into the Uint8Array the PushManager
// subscription call expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// Registers the service worker, subscribes this device to Web Push, and
// persists the subscription so the backend can push to it later. Also
// relays service-worker -> page messages (notification click) into the same
// navigation event the in-app notifications use.
export function usePushNotifications() {
  useEffect(() => {
    let cancelled = false;
    let swMessageHandler = null;

    const run = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const authed = await base44.auth.isAuthenticated();
        if (!authed || cancelled) return;
        const me = await base44.auth.me();
        if (!me || cancelled) return;

        swMessageHandler = (event) => {
          const d = event && event.data;
          if (d && d.type === 'motogo:open-conversation' && d.conversationId) {
            window.dispatchEvent(
              new CustomEvent('motogo:open-conversation', { detail: { conversationId: d.conversationId } })
            );
          }
        };
        navigator.serviceWorker.addEventListener('message', swMessageHandler);

        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (cancelled) return;
        await navigator.serviceWorker.ready;

        if (Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch (e) {
            /* some browsers require a user gesture */
          }
        }
        if (Notification.permission !== 'granted' || cancelled) return;

        const cfgRes = await base44.functions.invoke('get-push-config', {});
        const vapidPublicKey = cfgRes?.data?.vapidPublicKey;
        if (!vapidPublicKey || cancelled) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }
        if (cancelled || !sub) return;

        const endpoint = sub.endpoint;
        const p256dh = sub.getKey('p256dh');
        const auth = sub.getKey('auth');
        const p256dhKey = p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : '';
        const authKey = auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '';

        // De-dupe: only store one record per (user, endpoint).
        const existing = await base44.entities.PushSubscription.filter(
          { endpoint },
          '-created_date',
          10
        );
        const found = (existing || []).find((s) => s.user_id === me.id);
        if (!found) {
          await base44.entities.PushSubscription.create({
            user_id: me.id,
            endpoint,
            p256dh_key: p256dhKey,
            auth_key: authKey,
            user_agent: navigator.userAgent || '',
          });
        }
      } catch (e) {
        // Push is best-effort — never block the app on it.
      }
    };

    run();

    return () => {
      cancelled = true;
      if (swMessageHandler) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
      }
    };
  }, []);
}