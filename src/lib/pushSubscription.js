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

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermissionGranted() {
  return pushSupported() && Notification.permission === 'granted';
}

// Registers the service worker, subscribes this device to Web Push and stores
// the subscription for the signed-in account. Safe to call on every launch:
// an existing subscription is reused and only stored once per user+endpoint.
export async function ensurePushSubscription() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission' };

  const me = await base44.auth.me().catch(() => null);
  if (!me) return { ok: false, reason: 'anonymous' };

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const reg = await navigator.serviceWorker.ready;

    const cfgRes = await base44.functions.invoke('get-push-config', {});
    const vapidPublicKey = cfgRes?.data?.vapidPublicKey;
    if (!vapidPublicKey) return { ok: false, reason: 'config' };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    if (!sub) return { ok: false, reason: 'subscribe' };

    const endpoint = sub.endpoint;
    const p256dh = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    const p256dhKey = p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : '';
    const authKey = auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '';

    const existing = await base44.entities.PushSubscription.filter({ endpoint }, '-created_date', 10);
    const mine = (existing || []).find((s) => s.user_id === me.id);

    if (mine) {
      // Keys can rotate; keep the stored pair in step with the live subscription.
      if (mine.p256dh_key !== p256dhKey || mine.auth_key !== authKey) {
        await base44.entities.PushSubscription.update(mine.id, {
          p256dh_key: p256dhKey,
          auth_key: authKey,
        });
      }
    } else {
      // This device endpoint may still be registered to a previously signed-in
      // account — claim it so pushes reach the rider using it now.
      const claimed = (existing || [])[0];
      if (claimed) {
        await base44.entities.PushSubscription.delete(claimed.id).catch(() => {});
      }
      await base44.entities.PushSubscription.create({
        user_id: me.id,
        endpoint,
        p256dh_key: p256dhKey,
        auth_key: authKey,
        user_agent: navigator.userAgent || '',
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', error: e?.message };
  }
}

// Reports what this device actually has right now, so the UI can never claim
// notifications are on when the push subscription was never stored.
export async function getPushStatus() {
  if (!pushSupported()) return { permission: 'unsupported', subscribed: false };
  const permission = Notification.permission;
  if (permission !== 'granted') return { permission, subscribed: false };

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return { permission, subscribed: false };

    const me = await base44.auth.me().catch(() => null);
    if (!me) return { permission, subscribed: false };

    const rows = await base44.entities.PushSubscription.filter({ endpoint: sub.endpoint }, '-created_date', 10);
    const subscribed = (rows || []).some((r) => r.user_id === me.id);
    return { permission, subscribed };
  } catch (e) {
    return { permission, subscribed: false };
  }
}