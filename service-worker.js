const CACHE_NAME = 'meteoro-shell-v047-cindy-prep1';
const LAYOUT_SCRIPT = './assets/meteoro-layout-v042.js';
const ENHANCEMENT_SCRIPT = './assets/meteoro-enhancements-v044.js';
const FIX_SCRIPT = './assets/meteoro-v044-fix.js';
const AS_SCRIPT = './assets/meteoro-as-v046.js';
const CINDY_SCRIPT = './assets/meteoro-cindy-v048.js';
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
  LAYOUT_SCRIPT,
  ENHANCEMENT_SCRIPT,
  FIX_SCRIPT,
  AS_SCRIPT,
  CINDY_SCRIPT
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

const CORE_BRIDGE = `
/* __METEORO_CORE_BRIDGE_V046__ */
(function(){
  function bind(name,getter,setter){
    try{Object.defineProperty(window,name,{configurable:true,enumerable:false,get:getter,set:setter||function(){}})}catch(e){try{window[name]=getter()}catch(_){}}
  }
  bind('currentAuthUser',function(){return currentAuthUser},function(v){currentAuthUser=v});
  bind('currentAuthToken',function(){return currentAuthToken},function(v){currentAuthToken=v});
  bind('PORTAL_DEFS',function(){return PORTAL_DEFS});
  bind('products',function(){return products});
  bind('productsById',function(){return productsById});
  bind('quoteCoverageMode',function(){return quoteCoverageMode});
  bind('quoteCoverageOptions',function(){return quoteCoverageOptions},function(v){quoteCoverageOptions=v});
  bind('quoteEval',function(){return quoteEval},function(v){quoteEval=v});
  bind('quoteCoverageModeLabel',function(){return quoteCoverageModeLabel},function(v){quoteCoverageModeLabel=v});
  bind('renderQuotes',function(){return renderQuotes},function(v){renderQuotes=v});
  bind('renderProducts',function(){return renderProducts},function(v){renderProducts=v});
  bind('renderPackages',function(){return renderPackages},function(v){renderPackages=v});
  bind('renderWellness',function(){return renderWellness},function(v){renderWellness=v});
  bind('selectedQuoteSnapshot',function(){return selectedQuoteSnapshot},function(v){selectedQuoteSnapshot=v});
  bind('simpleLayerAmount',function(){return simpleLayerAmount},function(v){simpleLayerAmount=v});
  bind('effectivePermissions',function(){return effectivePermissions},function(v){effectivePermissions=v});
  bind('portalAllowed',function(){return portalAllowed},function(v){portalAllowed=v});
  bind('portalPermissionSummary',function(){return portalPermissionSummary},function(v){portalPermissionSummary=v});
  bind('readNewPermissions',function(){return readNewPermissions},function(v){readNewPermissions=v});
  bind('applyRoleVisibility',function(){return applyRoleVisibility},function(v){applyRoleVisibility=v});
  bind('revealAuthorizedAppRemote',function(){return revealAuthorizedAppRemote},function(v){revealAuthorizedAppRemote=v});
  bind('getCase',function(){return getCase},function(v){getCase=v});
  bind('mk',function(){return mk});
  bind('statusRank',function(){return statusRank});
  bind('money',function(){return money});
  bind('updateSelectedTotal',function(){return updateSelectedTotal});
  bind('renderCommission',function(){return renderCommission});
  bind('refreshCompanySelect',function(){return refreshCompanySelect});
  bind('apiCall',function(){return apiCall});
  bind('loadRemoteUsers',function(){return loadRemoteUsers});
  bind('loadRemoteAudit',function(){return loadRemoteAudit});
})();
`;

async function injectNavigatorLayout(req){
  const res=await fetch(req,{cache:'no-store'});
  if(!res.ok) return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html')) return res;
  let html=await res.text();

  const startMarker='function startApp(){registerMeteoroPwa();initAuthGate()}';
  if(!html.includes('__METEORO_CORE_BRIDGE_V046__') && html.includes(startMarker)){
    html=html.replace(startMarker,CORE_BRIDGE+'\n'+startMarker);
  }
  const injectBeforeClosingBody = markup => {
    const closing='</body>';
    const index=html.toLowerCase().lastIndexOf(closing);
    if(index<0) return;
    html=html.slice(0,index)+markup+html.slice(index);
  };
  if(!html.includes('meteoro-layout-v042.js')){
    injectBeforeClosingBody('<script src="./assets/meteoro-layout-v042.js?v=47"></script>');
  }
  if(!html.includes('meteoro-enhancements-v044.js')){
    injectBeforeClosingBody('<script src="./assets/meteoro-enhancements-v044.js?v=47"></script>');
  }
  if(!html.includes('meteoro-v044-fix.js')){
    injectBeforeClosingBody('<script src="./assets/meteoro-v044-fix.js?v=47"></script>');
  }
  if(!html.includes('meteoro-as-v046.js')){
    injectBeforeClosingBody('<script src="./assets/meteoro-as-v046.js?v=47-hotfix2"></script>');
  }
  if(!html.includes('meteoro-cindy-v048.js')){
    injectBeforeClosingBody('<script src="./assets/meteoro-cindy-v048.js?v=48-prep1"></script>');
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

  if(url.pathname.endsWith('/assets/meteoro-layout-v042.js') || url.pathname.endsWith('/assets/meteoro-enhancements-v044.js') || url.pathname.endsWith('/assets/meteoro-v044-fix.js') || url.pathname.endsWith('/assets/meteoro-as-v046.js')){
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
