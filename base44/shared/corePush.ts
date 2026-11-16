// Base44-published native app push (the Play Store build of MotoVeya).
//
// That build is produced by the platform, so it never registers an FCM token in
// NativeDevice and has no Web Push API inside its WebView. Core.SendPushNotification
// is the only channel that reaches it. It costs 1 credit per send and fails for a
// rider who has no native app, so it is capped for large fan-outs (announcements)
// and only used for alerts aimed at individuals or small groups.

const MAX_CORE_PUSH_RECIPIENTS = 25;
const APP_ORIGIN = 'https://motoveya.base44.app';

function absoluteUrl(payload) {
  const path = payload?.action_url
    ? String(payload.action_url)
    : payload?.conversationId
      ? '/community'
      : '/';
  if (/^https?:\/\//i.test(path)) return path;
  return `${APP_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function sendCorePushToUsers(svc, userIds, payload) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return { sent: 0 };
  if (ids.length > MAX_CORE_PUSH_RECIPIENTS) return { sent: 0, skipped: ids.length };

  const title = String(payload?.title || 'MotoVeya');
  const content = String(payload?.body || '');
  const actionUrl = absoluteUrl(payload);
  let sent = 0;

  for (const userId of ids) {
    try {
      await svc.integrations.Core.SendPushNotification({ user_id: userId, title, content, action_url: actionUrl });
      sent += 1;
    } catch (e) {
      // No native app installed for this rider, or push not configured — either
      // way Web Push / FCM already carried the alert where it could.
    }
  }
  return { sent };
}