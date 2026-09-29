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

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Requests notification permission on a user gesture, then registers the
// service worker + Web Push subscription and persists it. Returns the final
// permission state: 'granted' | 'denied' | 'default' | 'unsupported'.
export async function enableNotifications() {
  if (!notificationsSupported()) return 'unsupported';

  let permission = 'default';
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    return 'default';
  }
  if (permission !== 'granted') return permission;

  try {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) return permission;
    const me = await base44.auth.me();
    if (!me) return permission;

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const cfgRes = await base44.functions.invoke('get-push-config', {});
    const vapidPublicKey = cfgRes?.data?.vapidPublicKey;
    if (!vapidPublicKey) return permission;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    if (!sub) return permission;

    const endpoint = sub.endpoint;
    const p256dh = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    const p256dhKey = p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : '';
    const authKey = auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '';

    // De-dupe: only store one record per (user, endpoint).
    const existing = await base44.entities.PushSubscription.filter({ endpoint }, '-created_date', 10);
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
    // Permission was granted but subscription failed — still report granted
    // so the UI reflects the permission state; the background hook will retry.
  }
  return permission;
}