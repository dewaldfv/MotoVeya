import { ensurePushSubscription, pushSupported } from '@/lib/pushSubscription';

export function notificationsSupported() {
  return pushSupported();
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Requests notification permission on a user gesture, then registers the
// service worker + Web Push subscription and persists it. Returns the final
// permission state: 'granted' | 'denied' | 'default' | 'unsupported'.
export async function enableNotifications() {
  if (!pushSupported()) return 'unsupported';

  let permission = 'default';
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    return 'default';
  }
  if (permission !== 'granted') return permission;

  await ensurePushSubscription();
  // Lets the running app hook pick the subscription up immediately.
  window.dispatchEvent(new CustomEvent('motoveya:notifications-enabled'));
  return permission;
}