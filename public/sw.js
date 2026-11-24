/* STAMP service worker — offline app shell.
   Pages: network first, falling back to the cached copy (and then to /app).
   Hashed build assets: cache first. The AI routes and Supabase are never cached. */

const VERSION = 'stamp-v1';
const PAGES = ['/app', '/app/discover', '/app/feed', '/app/people', '/app/wrapped', '/app/archivist', '/app/diplomat', '/app/shield', '/'];
const STATIC = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon.svg'];

async function precache() {
  const cache = await caches.open(VERSION);
  await cache.addAll(STATIC);
  const assets = new Set();
  await Promise.all(
    PAGES.map(async (url) => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return;
        const html = await res.clone().text();
        await cache.put(url, res);
        for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assets.add(m[0]);
      } catch (e) {
        /* offline during install: runtime caching fills in later */
      }
    }),
  );
  await Promise.all([...assets].map((a) => cache.add(a).catch(() => undefined)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('stamp-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function put(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/screens/') || url.pathname.startsWith('/_next/image')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => put(req, res))
        .catch(async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match('/app')) || Response.error()),
    );
    return;
  }

  // RSC payloads and everything else on this origin: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => put(req, res))
        .catch(() => hit || Response.error());
      return hit || net;
    }),
  );
});
