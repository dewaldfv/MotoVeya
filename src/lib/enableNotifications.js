import { ensurePushSubscription, getPushStatus, pushSupported } from '@/lib/pushSubscription';

export function notificationsSupported() {
  return pushSupported();
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
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

// Requests notification permission on a user gesture, then registers the
// service worker + Web Push subscription and persists it.
// Returns { permission, subscribed, reason } describing the real outcome.
export async function enableNotifications() {
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