/* Selfieface storefront service worker — shell cache + offline fallback.
 * Not a full offline catalog (checkout/API still need network). */
const CACHE = 'selfieface-shell-v2';
const PRECACHE = ['/offline.html', '/brand/open-graph.png', '/brand/mark.png', '/brand/favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth / checkout / cart mutations surface
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/checkout') ||
    url.pathname.includes('/account/')
  ) {
    return;
  }

  // Navigations: network first, offline page fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/offline.html');
        }),
    );
    return;
  }

  // Static brand / next assets: stale-while-revalidate style
  if (
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/offline.html'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return res;
          }),
      ),
    );
  }
});
