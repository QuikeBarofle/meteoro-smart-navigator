const CACHE_NAME = 'meteoro-shell-v039';
const SHELL = [
  './',
  './index.html',
  './install.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './assets/meteoro-login-car.png',
  './assets/meteoro-helmet.png',
  './assets/meteoro-guide-1.png',
  './assets/meteoro-guide-2.png',
  './assets/meteoro-guide-3.png',
  './assets/meteoro-guide-4.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('meteoro-shell-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  if (url.pathname.toLowerCase().endsWith('.pdf') || url.pathname.toLowerCase().endsWith('.pptx')) return;

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return res;
    }))
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {body: event.data ? event.data.text() : ''}; }
  const title = data.title || 'Meteoro · Seguimientos';
  const options = {
    body: data.body || 'Tienes seguimientos pendientes.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'meteoro-followups',
    renotify: true,
    data: {url: data.url || './index.html?open=followups'},
    actions: [{action:'open-followups', title:'Ver seguimientos'}]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './index.html?open=followups', self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(async clients => {
      for (const client of clients) {
        try {
          if ('navigate' in client) await client.navigate(target);
          return client.focus();
        } catch (e) {}
      }
      return self.clients.openWindow(target);
    })
  );
});
