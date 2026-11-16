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
  // Permission granted here must also start the background Web Push subscription,
  // otherwise nothing arrives once the app is minimized.
  if (Notification.permission === 'granted' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('motoveya:notifications-enabled'));
  }
  return Notification.permission;
}

export async function showMessageNotification({ title, body, conversationId }) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const options = {
    body: (body || '').slice(0, 200),
    tag: conversationId,
    renotify: true,
    data: { conversationId },
  };
  try {
    // Phones only show notifications raised by the service worker registration —
    // `new Notification()` throws or is ignored on mobile browsers.
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch (e) {
    /* fall through to the page-level notification */
  }
  try {
    const n = new Notification(title, options);
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