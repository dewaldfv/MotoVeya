import { ensurePushSubscription, getPushStatus, pushSupported } from '@/lib/pushSubscription';
import {
  isNativeNotificationPermissionGranted,
  isNativeNotificationSupported,
  requestNativeNotificationPermission,
} from '@/lib/nativeTracking';
import { getNativePushStatus, syncNativePush } from '@/lib/nativePush';

// Android shell: OS permission only. Web push subscriptions do not exist inside
// a WebView, so nothing here may claim the device is registered for push.
export function nativeNotificationsAvailable() {
  return isNativeNotificationSupported();
}

export function notificationsSupported() {
  return isNativeNotificationSupported() || pushSupported();
}

export function notificationPermission() {
  if (isNativeNotificationSupported()) {
    return isNativeNotificationPermissionGranted() ? 'granted' : 'default';
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Current state for the Settings row: { permission, subscribed, native }.
export async function getNotificationStatus() {
  if (isNativeNotificationSupported()) {
    const status = await getNativePushStatus();
    return {
      native: true,
      permission: status.permission,
      subscribed: !!status.registered,
    };
  }
  const status = await getPushStatus();
  return { ...status, native: false };
}

const REASON_MESSAGES = {
  unsupported: 'Notifications are not supported on this device',
  permission: 'Allow notifications in your browser settings to finish setup',
  anonymous: 'Sign in again to finish notification setup',
  config: 'Notification service is not configured',
  subscribe: 'This device could not subscribe — check your connection and try again',
  error: 'Could not finish notification setup — please try again',
};

export function notificationSetupMessage(reason) {
  return REASON_MESSAGES[reason] || null;
}

// Native: asks Android for POST_NOTIFICATIONS.
// Web: requests permission, then registers the service worker + Web Push
// subscription and persists it.
// Returns { permission, subscribed, native, reason } describing the real outcome.
export async function enableNotifications() {
  if (isNativeNotificationSupported()) {
    const granted = await requestNativeNotificationPermission();
    if (granted === null) return { permission: 'unsupported', subscribed: false, native: true, reason: 'unsupported' };
    if (!granted) return { permission: 'denied', subscribed: false, native: true, reason: 'denied' };
    // Permission alone does not deliver alerts: the phone's push token must be
    // registered with the account first.
    const registered = await syncNativePush();
    return {
      permission: 'granted',
      subscribed: !!registered.registered,
      native: true,
      reason: registered.registered ? null : 'subscribe',
    };
  }

  if (!pushSupported()) return { permission: 'unsupported', subscribed: false, reason: 'unsupported' };

  let permission = 'default';
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    return { permission: 'default', subscribed: false, reason: 'permission' };
  }
  if (permission !== 'granted') return { permission, subscribed: false, reason: permission };

  const result = await ensurePushSubscription();
  if (result.ok) {
    // Lets the running app hook pick the subscription up immediately.
    window.dispatchEvent(new CustomEvent('motoveya:notifications-enabled'));
    return { permission: 'granted', subscribed: true };
  }

  // Permission may be granted while the subscription failed — report what is stored.
  const status = await getPushStatus();
  return { permission, subscribed: status.subscribed, reason: result.reason };
}