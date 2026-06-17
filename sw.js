const CACHE_NAME = 'exam-simulator2-local-library-a19.3-20260618-v3';
const APP_SHELL = [
  './', './index.html?v=A19.3', './offline.html', './manifest.webmanifest', './jszip.min.js',
  './icons/icon-192.png', './icons/icon-512.png',
  './ui_icons/prev.png', './ui_icons/next.png', './ui_icons/lab.png', './ui_icons/notes.png', './ui_icons/calculator.png', './ui_icons/settings.png', './ui_icons/lock.png', './ui_icons/endblock.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const url = new URL(req.url);
  const isNav = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isNav) {
    event.respondWith(fetch(req, {cache:'no-store'}).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html?v=A19.3', copy)).catch(()=>{});
      return resp;
    }).catch(() => caches.match('./index.html?v=A19.3').then(hit => hit || caches.match('./offline.html'))));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(resp => {
    const copy = resp.clone();
    if(resp.ok && url.origin === location.origin) caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
    return resp;
  }).catch(() => caches.match('./offline.html'))));
});
