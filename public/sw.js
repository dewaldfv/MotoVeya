// MotoGo service worker — receives Web Push events and shows a device
// notification when a new group or private message arrives, even when the
// app is closed. Clicking the notification focuses/opens the app and
// jumps to the relevant conversation.
const APP_NAME = 'MotoGo';

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
  const options = {
    body: (data.body || '').slice(0, 200),
    tag: conversationId || 'motogo-message',
    renotify: true,
    data: {
      conversationId,
      url: data.url || '/community',
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
          if (conversationId) {
            c.postMessage({ type: 'motogo:open-conversation', conversationId });
          }
          return;
        }
      }
      const newClient = await self.clients.openWindow(targetUrl);
      if (newClient && conversationId) {
        setTimeout(() => {
          try {
            newClient.postMessage({ type: 'motogo:open-conversation', conversationId });
          } catch (e) {
            /* ignore */
          }
        }, 1500);
      }
    })()
  );
});
