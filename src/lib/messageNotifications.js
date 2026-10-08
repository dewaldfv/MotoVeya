// Lightweight helpers for OS-level (Web Notifications API) message alerts
// shown when the app is open and focused. Server-side Web Push (VAPID)
// handles delivery when the app is closed; the service worker suppresses
// duplicate system notifications when a page is focused.

let activeConversationId = null;

export function setActiveConversation(id) {
  activeConversationId = id || null;
}

export function getActiveConversationId() {
  return activeConversationId;
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) {
      /* ignore — some browsers require a user gesture */
    }
  }
  return Notification.permission;
}

export function showMessageNotification({ title, body, conversationId }) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body: (body || '').slice(0, 200),
      tag: conversationId,
      renotify: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
      window.dispatchEvent(
        new CustomEvent('motogo:open-conversation', { detail: { conversationId } })
      );
    };
  } catch (e) {
    /* ignore */
  }
}