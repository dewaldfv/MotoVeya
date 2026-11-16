import {
  isNativeNotificationPermissionGranted,
  isNativePushAvailable,
  registerNativeDevice,
  requestNativePushToken,
} from '@/lib/nativeTracking';

const FCM_TOKEN_KEY = 'motoveya_fcm_token';
const RESYNC_AFTER_MS = 10 * 60 * 1000;

// Avoids re-registering the same token on every screen focus.
let lastSyncedToken = null;
let lastSyncedAt = 0;

export function getStoredPushToken() {
  try { return localStorage.getItem(FCM_TOKEN_KEY) || null; } catch { return null; }
}

// Hand this phone's FCM token to the server so alerts reach the installed app
// while it is closed. Runs only inside the Android shell, and only once the
// rider has allowed notifications. Returns the real registration outcome.
export async function syncNativePush() {
  if (!isNativePushAvailable()) return { available: false, registered: false, token: null };
  if (!isNativeNotificationPermissionGranted()) {
    return { available: true, registered: false, token: null, permission: 'default' };
  }
  const token = await requestNativePushToken();
  if (!token) return { available: true, registered: false, token: null };

  // Same token, recently confirmed: no need to hit the server again.
  if (token === lastSyncedToken && Date.now() - lastSyncedAt < RESYNC_AFTER_MS) {
    return { available: true, registered: true, token };
  }

  try { localStorage.setItem(FCM_TOKEN_KEY, token); } catch {}
  try {
    const device = await registerNativeDevice({ pushToken: token });
    lastSyncedToken = token;
    lastSyncedAt = Date.now();
    return { available: true, registered: !!device?.pushRegistered, token };
  } catch (e) {
    console.error('native push registration failed', e);
    return { available: true, registered: false, token };
  }
}

// Settings status: permission granted is NOT the same as registered for push.
export async function getNativePushStatus() {
  if (!isNativePushAvailable()) {
    return { available: false, permission: 'unsupported', registered: false };
  }
  if (!isNativeNotificationPermissionGranted()) {
    return { available: true, permission: 'default', registered: false };
  }
  const result = await syncNativePush();
  return { available: true, permission: 'granted', registered: !!result.registered };
}