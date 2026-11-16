// Shared Web Push helper used by messaging-secure (messages, invites,
// approvals) and the emergency response (Rider Down alerts to nearby riders).
// Centralized so any backend function can deliver OS-level pushes through the
// same VAPID config and expired-subscription pruning.

import { secrets } from 'base44:runtime';
import webpush from 'npm:web-push@3.6.7';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = secrets.get('VAPID_PUBLIC_KEY');
  const privateKey = secrets.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set');
  }
  webpush.setVapidDetails('mailto:Dewald.motoVeya@gmail.com', publicKey, privateKey);
  vapidConfigured = true;
}

// Send a Web Push notification to every stored subscription owned by the
// given user ids. `svc` is a base44 service-role client (bypasses RLS so we
// can read other users' subscriptions). Expired/invalid subscriptions are
// pruned automatically.
export async function sendPushToUsers(svc, userIds, payload) {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return { sent: 0 };
  try {
    ensureVapid();
  } catch (e) {
    console.error('webPush ensureVapid', e.message);
    return { sent: 0, error: e.message };
  }
  let subs = [];
  try {
    subs = await svc.entities.PushSubscription.list('-created_date', 500);
  } catch (e) {
    console.error('webPush list subs', e.message);
    return { sent: 0, error: e.message };
  }
  const idSet = new Set(ids);
  const mine = (subs || []).filter((s) => idSet.has(s.user_id));
  if (mine.length === 0) return { sent: 0 };
  const payloadStr = JSON.stringify(payload || {});
  let sent = 0;
  await Promise.all(
    mine.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
          payloadStr
        )
        .then(() => { sent += 1; })
        .catch(async (err) => {
          const status = err && err.statusCode;
          if (status === 404 || status === 410) {
            try { await svc.entities.PushSubscription.delete(s.id); } catch (e) {}
          }
        })
    )
  );
  return { sent };
}