/* Bonklandia service worker — installable shell only.
 * Never cache app JS/CSS or API. Stale chunks were hiding new deploys.
 */

const CACHE_VERSION = 'bonklandia-static-v5-nocache-js';
const STATIC_CACHE = CACHE_VERSION;

function isNeverCache(url) {
  const p = url.pathname;
  if (p.startsWith('/api/')) return true;
  // Always network for Next bundles so deploys show up immediately
  if (p.startsWith('/_next/')) return true;
  if (p.startsWith('/assets/')) return true;
  if (p.startsWith('/alice') && url.search.includes('session')) return true;
  if (/\.(mp3|mp4|webm|wav|ogg)$/i.test(p)) return true;
  if (p.startsWith('/audio/')) return true;
  return false;
}

function isStaticAsset(url) {
  const p = url.pathname;
  if (p.startsWith('/icons/')) return true;
  if (p === '/favicon.ico' || p.startsWith('/favicon')) return true;
  if (p === '/manifest.webmanifest' || p === '/manifest.webmanifest/') return true;
  return false;
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(['/icons/icon-192.png', '/icons/icon-512.png']).catch(() => {}),
    ),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Wipe every old cache so clients never stick on previous app shells
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (isNeverCache(url)) {
    event.respondWith(fetch(req));
    return;
  }

  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => res)
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(
            '<!doctype html><meta charset=utf-8><title>Bonklandia</title><body style="background:#0c0618;color:#e9d5ff;font-family:system-ui;padding:2rem;text-align:center"><h1>Bonklandia</h1><p>You are offline. Reconnect to play.</p></body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }),
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  // Icons only: network first, then cache
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      }
    })(),
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});
