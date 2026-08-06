/* Bonklandia Phase-1 service worker
 *
 * Goals:
 * - Make the site installable (needs a SW + fetch handler)
 * - Cache only immutable-ish static assets for snappier repeat visits
 *
 * Never cache:
 * - /api/* (chips, casino, alice complete, treasury — money truth)
 * - HTML navigations as long-lived offline shells (always network-first)
 * - Large media (audio, alice videos) — avoid filling device storage
 */

const CACHE_VERSION = 'bonklandia-static-v1';
const STATIC_CACHE = CACHE_VERSION;

/** Paths we never put in the Cache API. */
function isNeverCache(url) {
  const p = url.pathname;
  if (p.startsWith('/api/')) return true;
  if (p.startsWith('/alice') && url.search.includes('session')) return true;
  // Avoid caching huge media by default
  if (/\.(mp3|mp4|webm|wav|ogg)$/i.test(p)) return true;
  if (p.startsWith('/audio/')) return true;
  if (p.includes('/entities/anim/')) return true;
  return false;
}

/** Safe-to-cache static assets (network first, then cache fill). */
function isStaticAsset(url) {
  const p = url.pathname;
  if (p.startsWith('/_next/static/')) return true;
  if (p.startsWith('/icons/')) return true;
  if (p === '/favicon.ico' || p.startsWith('/favicon')) return true;
  if (p === '/manifest.webmanifest' || p === '/manifest.webmanifest/') return true;
  // Still PNG entity/character art is ok (not anim videos)
  if (p.startsWith('/assets/') && /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(p)) return true;
  return false;
}

self.addEventListener('install', event => {
  // Activate ASAP so new builds take over without waiting for tabs to close forever
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(['/icons/icon-192.png', '/icons/icon-512.png']).catch(() => {
        /* offline first visit — fine */
      }),
    ),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => k.startsWith('bonklandia-') && k !== STATIC_CACHE)
          .map(k => caches.delete(k)),
      );
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

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  if (isNeverCache(url)) {
    // Bypass SW cache entirely — go to network
    event.respondWith(fetch(req));
    return;
  }

  // Navigations / HTML: network-first, no long-term offline app shell
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => res)
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Minimal offline fallback
          return new Response(
            '<!doctype html><meta charset=utf-8><title>Bonklandia</title><body style="background:#0c0618;color:#e9d5ff;font-family:system-ui;padding:2rem;text-align:center"><h1>Bonklandia</h1><p>You are offline. Reconnect to play and bank chips.</p><p><a href="/" style="color:#67e8f9">Retry</a></p></body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }),
    );
    return;
  }

  if (!isStaticAsset(url)) {
    // Default: network only (don't invent a cache for unknown paths)
    return;
  }

  // Static assets: stale-while-revalidate style (cache hit + update)
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      const networkPromise = fetch(req)
        .then(res => {
          if (res && res.ok) {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Kick off update; return cached immediately
        networkPromise.catch(() => {});
        return cached;
      }
      const network = await networkPromise;
      if (network) return network;
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});

// Allow the page to ask this SW to take control immediately after update
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
