// Lightweight helpers for OS-level (Web Notifications API) message alerts.
// The Base44 platform does not support server-side push, so notifications
// are triggered client-side from the realtime Message subscription while
// the app is installed/open. On Android Chrome PWA and iOS (home-screen
// installed) these surface in the system notification center like WhatsApp.

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