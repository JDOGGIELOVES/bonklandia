'use client';

import { useEffect } from 'react';
import { BRAND } from '@/lib/brand';

/**
 * Registers Phase-1 service worker (production only).
 * Safe: SW never caches /api/* ledger routes.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Dev HMR + SW fights — only register on real deploys
    if (process.env.NODE_ENV !== 'production') return;

    const swUrl = `/sw.js?v=${encodeURIComponent(BRAND.buildId)}`;

    // No auto-reload on controllerchange — that can interrupt Alice bank / wallet flows.
    // New SW activates; next navigation picks up the new shell.

    navigator.serviceWorker
      .register(swUrl, { scope: '/' })
      .then(reg => {
        const ping = () => {
          try {
            void reg.update();
          } catch {
            /* */
          }
        };
        window.addEventListener('focus', ping);
        window.setTimeout(ping, 4000);

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {
        /* registration can fail on restricted browsers — ignore */
      });
  }, []);

  return null;
}
