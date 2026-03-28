const CACHE_NAME = 'fitness-pwa-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});

// ─── Push通知の受取 ───
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'IRON', body: 'ジムに行く時間だ。' };
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };
  e.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── 通知クリック時の動作 ───
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
