/**
 * CampusTrack Service Worker
 * Powered by Web Push Protocol
 */

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'CampusTrack Alert 🔔', body: event.data.text() };
    }
  }

  const title = data.title || 'CampusTrack Update 🔔';
  const options = {
    body: data.body || 'Something new is happening in your classroom!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {},
    vibrate: [150, 80, 150],
    tag: 'campustrack-push-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'Open CampusTrack 🚀' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.indexOf('/') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
