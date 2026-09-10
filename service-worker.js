const CACHE_NAME = 'meteoro-shell-v042';
const LAYOUT_SCRIPT = './assets/meteoro-layout-v042.js';
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
  './assets/meteoro-guide-4.png',
  LAYOUT_SCRIPT
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

function isNavigatorPage(url){
  const p=url.pathname.replace(/\/+$/,'/');
  return p.endsWith('/meteoro-smart-navigator/') || p.endsWith('/meteoro-smart-navigator/index.html');
}

async function injectNavigatorLayout(req){
  const res=await fetch(req,{cache:'no-store'});
  if(!res.ok) return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html')) return res;
  let html=await res.text();
  if(!html.includes('meteoro-layout-v042.js')){
    html=html.replace(/<\/body>/i,'<script src="./assets/meteoro-layout-v042.js?v=42"></script></body>');
  }
  const headers=new Headers(res.headers);
  headers.set('content-type','text/html; charset=utf-8');
  headers.set('cache-control','no-cache');
  const out=new Response(html,{status:res.status,statusText:res.statusText,headers});
  const cache=await caches.open(CACHE_NAME);
  await cache.put(req,out.clone());
  return out;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    if(isNavigatorPage(url)){
      event.respondWith(
        injectNavigatorLayout(req).catch(() =>
          caches.match(req).then(r => r || caches.match('./index.html'))
        )
      );
    } else {
      event.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
      );
    }
    return;
  }

  if (url.pathname.toLowerCase().endsWith('.pdf') || url.pathname.toLowerCase().endsWith('.pptx')) return;

  if(url.pathname.endsWith('/assets/meteoro-layout-v042.js')){
    event.respondWith(fetch(req,{cache:'no-store'}).then(res => {
      const copy=res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req,copy));
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

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
