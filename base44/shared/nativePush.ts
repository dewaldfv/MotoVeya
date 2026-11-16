// Native Android push delivery (Firebase Cloud Messaging HTTP v1).
//
// The Play Store app is a WebView shell: it has no Web Push API, so browser
// subscriptions never reach it. Every alert that fans out through
// sendPushToUsers() (messages, invites, approvals, events, emergency alerts)
// therefore also goes to the FCM tokens registered by that shell.
//
// The shell registers its token in NativeDevice.push_token; delivery only
// targets devices that still have push enabled. Tokens FCM reports as gone are
// cleared so they are never retried.

import { secrets } from 'base44:runtime';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedAccessToken = '';
let cachedAccessExpiry = 0;

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlJson(value) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToDer(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) der[i] = raw.charCodeAt(i);
  return der;
}

function readServiceAccount() {
  const raw = secrets.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('FCM_SERVICE_ACCOUNT_JSON not set');
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON is missing client_email, private_key or project_id');
  }
  return sa;
}

// Exchanges the service-account key for an OAuth access token (cached ~1 hour).
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessExpiry - 60 > now) return cachedAccessToken;

  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claims = base64UrlJson({
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claims}`)
  );
  const assertion = `${header}.${claims}.${toBase64Url(new Uint8Array(signature))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`FCM auth failed (${res.status})`);
  const data = await res.json();
  cachedAccessToken = data.access_token || '';
  cachedAccessExpiry = now + (data.expires_in || 3600);
  if (!cachedAccessToken) throw new Error('FCM auth returned no access token');
  return cachedAccessToken;
}

// Deep link the notification opens: an explicit url from the caller, otherwise
// the conversation (Community inbox) or the app's home screen.
function targetUrl(payload) {
  if (payload?.action_url) return String(payload.action_url);
  if (payload?.conversationId) return '/community';
  return '/';
}

function buildMessage(payload, token) {
  const data = {
    title: String(payload?.title || 'MotoVeya'),
    body: String(payload?.body || ''),
    url: targetUrl(payload),
    type: String(payload?.type || 'alert'),
  };
  if (payload?.conversationId) data.conversationId = String(payload.conversationId);
  if (payload?.isGroup) data.isGroup = 'true';
  return {
    token,
    // Data-only so the shell always renders the alert itself (custom channel,
    // deep link and in-app routing) instead of a bare system notification.
    data,
    android: { priority: 'HIGH', ttl: '86400s' },
  };
}

async function clearToken(svc, device) {
  try {
    await svc.entities.NativeDevice.update(device.id, {
      push_token: '',
      push_enabled: false,
      push_token_updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('nativePush clear token', e.message);
  }
}

async function sendToDevice(svc, endpoint, accessToken, device, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: buildMessage(payload, device.push_token) }),
    signal: AbortSignal.timeout(10000),
  });
  if (res.ok) return true;
  const detail = await res.text().catch(() => '');
  const gone = res.status === 404
    || detail.includes('UNREGISTERED')
    || detail.includes('registration-token-not-registered')
    || detail.includes('INVALID_ARGUMENT');
  if (gone) await clearToken(svc, device);
  else console.error('nativePush send failed', res.status, detail.slice(0, 200));
  return false;
}

// Send an alert to every registered Android device of the given user ids.
export async function sendNativePushToUsers(svc, userIds, payload) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return { sent: 0 };

  let sa;
  try {
    sa = readServiceAccount();
  } catch (e) {
    console.error('nativePush config', e.message);
    return { sent: 0, error: e.message };
  }

  let devices = [];
  try {
    devices = await svc.entities.NativeDevice.filter({ user_id: { $in: ids } }, '-created_date', 500);
  } catch (e) {
    console.error('nativePush load devices', e.message);
    return { sent: 0, error: e.message };
  }
  const targets = (devices || []).filter((d) => d.push_token && d.push_enabled !== false);
  if (targets.length === 0) return { sent: 0 };

  let accessToken;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    console.error('nativePush auth', e.message);
    return { sent: 0, error: e.message };
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  const batchSize = 8;
  for (let i = 0; i < targets.length; i += batchSize) {
    const slice = targets.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      slice.map((device) => sendToDevice(svc, endpoint, accessToken, device, payload))
    );
    results.forEach((r) => { if (r.status === 'fulfilled' && r.value) sent += 1; });
  }
  return { sent };
}