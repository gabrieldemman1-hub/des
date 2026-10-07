// Primer's service worker, filled in at build time (see astro.config.mjs). It stores every file of
// the guide on install, so the whole manual reads offline, and serves from that store first.
const VERSION = '__VERSION__';
const BASE = '__BASE__';
const FILES = [/*__FILES__*/];
const CACHE = `primer-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('primer-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // A page asked for without its trailing slash is the same page.
      const path = url.pathname.endsWith('/') || url.pathname.includes('.') ? url.pathname : `${url.pathname}/`;
      const cached = await cache.match(path);
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        if (request.mode === 'navigate') {
          const missing = await cache.match(`${BASE}404.html`);
          if (missing) return new Response(missing.body, { status: 404, headers: missing.headers });
        }
        return Response.error();
      }
    }),
  );
});
