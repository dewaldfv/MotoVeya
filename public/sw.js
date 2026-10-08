// MotoVeya service worker — receives Web Push events and shows a device
// notification when a new group or private message arrives, even when the
// app is closed. Clicking the notification focuses/opens the app and
// jumps to the relevant conversation.
const APP_NAME = 'MotoVeya';
const NOTIFICATION_ICON = 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/f859a5527_MotoVeya1.png';
const NOTIFICATION_BADGE = '/icon.svg';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || APP_NAME;
  const conversationId = data.conversationId || null;
  const targetUrl = data.action_url || data.url || (data.type && data.type.startsWith('crowd_clip_') ? '/crowd-clips' : '/community');
  const options = {
    body: (data.body || '').slice(0, 200),
    tag: data.clipId ? `crowd-clip-${data.clipId}` : (conversationId || 'motogo-message'),
    renotify: true,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    data: {
      conversationId,
      url: targetUrl,
    },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(
    (async () => {
      try {
        // If a page is open and focused, the in-app notification already
        // handles it — skip the system notification to avoid duplicates.
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const focused = clients.some((c) => c.focused === true);
        if (focused) return;
        return self.registration.showNotification(title, options);
      } catch (e) {
        return self.registration.showNotification(title, options);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const conversationId = event.notification.data && event.notification.data.conversationId;
  const targetUrl = (event.notification.data && event.notification.data.url) || '/community';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of allClients) {
        if ('focus' in c) {
          await c.focus();
          // Post a navigation message so the app deep-links to the
          // notification's target, whether it's a conversation or a
          // general page (ride invite, event, distress alert, etc.).
          c.postMessage({ type: 'motoveya:navigate', url: targetUrl, conversationId });
          return;
        }
      }
      const newClient = await self.clients.openWindow(targetUrl);
      if (newClient && conversationId) {
        setTimeout(() => {
          try {
            newClient.postMessage({ type: 'motoveya:navigate', url: targetUrl, conversationId });
          } catch (e) {
            /* ignore */
          }
        }, 1500);
      }
    })()
  );
});
