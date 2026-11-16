// Shared push helper used by messaging-secure (messages, invites, approvals),
// the emergency response (Rider Down alerts) and admin broadcasts.
//
// Two delivery channels, one call:
//  - Web Push (VAPID) for browsers and the installed PWA
//  - FCM for the Play Store Android app, whose WebView has no push API
// so every existing alert flow reaches a rider wherever MotoVeya is open.

import { secrets } from 'base44:runtime';
import webpush from 'npm:web-push@3.6.7';
import { sendNativePushToUsers } from './nativePush.ts';

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

// Web Push to every stored subscription of the given users. Expired/invalid
// subscriptions are pruned automatically.
async function sendWebPushToUsers(svc, ids, payload) {
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

// Send a notification to every device the given users have registered —
// browsers (Web Push) and the installed Android app (FCM).
export async function sendPushToUsers(svc, userIds, payload) {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return { sent: 0 };

  const web = await sendWebPushToUsers(svc, ids, payload);
  const native = await sendNativePushToUsers(svc, ids, payload).catch((e) => {
    console.error('webPush native', e.message);
    return { sent: 0, error: e.message };
  });

  return {
    sent: (web?.sent || 0) + (native?.sent || 0),
    webSent: web?.sent || 0,
    nativeSent: native?.sent || 0,
  };
}