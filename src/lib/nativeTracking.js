import { base44 } from '@/api/base44Client';

const TOKEN_KEY = 'motoveya_native_device_token';
const DEVICE_ID_KEY = 'motoveya_native_device_id';
const PLATFORM_KEY = 'motoveya_native_platform';

// A 32+ char opaque token generated client-side at first enable. The native
// build reads this same token to authenticate background calls (native-location,
// trigger-emergency-native, revoke-native-tracking) when there is no live session.
export function generateDeviceToken() {
  const bytes = new Uint8Array(40);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getStoredDeviceToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

export function getStoredDeviceId() {
  try { return localStorage.getItem(DEVICE_ID_KEY) || null; } catch { return null; }
}

export function detectPlatform() {
  if (typeof window === 'undefined') return 'android';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'android';
}

// Register (or re-register) this device for background tracking. Called from the
// web foreground where the user has a live session; the returned device_token is
// what the native background service later uses to authenticate.
export async function registerNativeDevice({ platform, appVersion } = {}) {
  let token = getStoredDeviceToken();
  if (!token) {
    token = generateDeviceToken();
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  }
  const plat = platform || detectPlatform();
  try { localStorage.setItem(PLATFORM_KEY, plat); } catch {}

  const res = await base44.functions.invoke('register-native-device', {
    device_token: token,
    platform: plat,
    app_version: appVersion || (navigator.userAgent || '').slice(0, 64),
  });
  const deviceId = res?.data?.device_id || res?.device_id;
  if (deviceId) {
    try { localStorage.setItem(DEVICE_ID_KEY, deviceId); } catch {}
  }
  return { token, deviceId, platform: plat };
}

export async function getMyDevices() {
  const me = await base44.auth.me();
  if (!me) return [];
  return (await base44.entities.NativeDevice.filter({ user_id: me.id }, '-created_date', 20)) || [];
}

export async function setTrackingEnabled(deviceId, enabled) {
  await base44.entities.NativeDevice.update(deviceId, { tracking_enabled: enabled });
}

// Called by the native bridge when the OS revokes location permission, or by the
// user from the in-app toggle. Hits the token-auth revocation endpoint so the
// server stops accepting background fixes immediately.
export async function revokeNativeTracking() {
  const token = getStoredDeviceToken();
  if (!token) return { ok: false };
  const res = await base44.functions.invoke('revoke-native-tracking', { device_token: token });
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(PLATFORM_KEY);
  } catch {}
  return res?.data || res;
}

export const NATIVE_TRACKING_ENDPOINTS = {
  location: 'native-location',
  emergency: 'trigger-emergency-native',
  revoke: 'revoke-native-tracking',
  riderLocation: 'update-rider-location-native',
};

export function getNativeBridge() {
  if (typeof window === 'undefined') return null;
  return window.MotoVeyaNative || window.AndroidMotoVeya || null;
}

export function isNativeLocationTrackingAvailable() {
  const bridge = getNativeBridge();
  try { return !!bridge?.isNativeLocationTrackingAvailable?.(); } catch { return false; }
}

export async function startNativeLocationTracking() {
  let token = getStoredDeviceToken();
  if (!token) {
    const registered = await registerNativeDevice({ platform: detectPlatform() });
    token = registered?.token || getStoredDeviceToken();
  }
  if (!token) return { started: false, native: false };
  const bridge = getNativeBridge();
  if (!bridge?.startNativeLocationTracking) return { started: false, native: false };
  try {
    const started = !!bridge.startNativeLocationTracking(token);
    return { started, native: true };
  } catch {
    return { started: false, native: true };
  }
}

export function stopNativeLocationTracking() {
  const bridge = getNativeBridge();
  if (!bridge?.stopNativeLocationTracking) return false;
  try { return !!bridge.stopNativeLocationTracking(); } catch { return false; }
}