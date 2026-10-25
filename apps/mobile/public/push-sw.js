// Reminder notifications (DECISIONS K3, K6), loaded into the generated service worker
// (scripts/build-sw.js). Shows each push from the reminder service (apps/push) and, when it is
// tapped, opens the item's day: in the open app if there is one, otherwise by starting it there.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Weekly Planner', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        // The app navigates itself (src/features/reminders/notificationTaps.ts), keeping its state.
        open.postMessage({ type: 'open-path', path });
        return open.focus();
      }
      return self.clients.openWindow(path);
    })(),
  );
});
