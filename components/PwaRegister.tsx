'use client';

import { useEffect } from 'react';
import { BRAND } from '@/lib/brand';

const BUILD_KEY = `${BRAND.storagePrefix}-last-build-id`;

/**
 * Registers SW + busts stale caches when buildId changes so deploys show up.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const prev = localStorage.getItem(BUILD_KEY);
    const isNewBuild = prev !== BRAND.buildId;
    localStorage.setItem(BUILD_KEY, BRAND.buildId);

    const swUrl = `/sw.js?v=${encodeURIComponent(BRAND.buildId)}`;

    void (async () => {
      try {
        if (isNewBuild && prev) {
          // New deploy: drop every Cache API entry so old JS never sticks
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }

        const reg = await navigator.serviceWorker.register(swUrl, { scope: '/' });

        const ping = () => {
          try {
            void reg.update();
          } catch {
            /* */
          }
        };
        window.addEventListener('focus', ping);
        window.setTimeout(ping, 2000);

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
              worker.postMessage({ type: 'CLEAR_CACHES' });
            }
          });
        });

        // One soft reload after a build change so the new app shell loads
        if (isNewBuild && prev && !sessionStorage.getItem(`${BUILD_KEY}-reloaded`)) {
          sessionStorage.setItem(`${BUILD_KEY}-reloaded`, '1');
          window.location.reload();
        }
      } catch {
        /* restricted browsers */
      }
    })();
  }, []);

  return null;
}
