const CACHE_VERSION = 'v1.0.0';
const CACHE_SHELL   = `shell-${CACHE_VERSION}`;
const CACHE_RUNTIME = `runtime-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/idb@8.0.0/build/umd.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_SHELL)
      .then(c => Promise.all(
        PRECACHE.map(url => c.add(url).catch(err => console.warn('precache falhou:', url, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_SHELL && k !== CACHE_RUNTIME)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.hostname === 'script.google.com') return;
  if (url.hostname === 'script.googleusercontent.com') return;

  if (url.hostname === 'opensheet.elk.sh') {
    e.respondWith(networkFirst(req, CACHE_RUNTIME));
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(navigateHandler(req));
    return;
  }

  e.respondWith(cacheFirst(req, CACHE_SHELL));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    fetch(req).then(resp => {
      if (resp && resp.ok) cache.put(req, resp.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
    throw err;
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  }
}

async function navigateHandler(req) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put('./index.html', resp.clone());
    return resp;
  } catch (err) {
    const cached = await cache.match('./index.html') || await cache.match('./');
    if (cached) return cached;
    throw err;
  }
}