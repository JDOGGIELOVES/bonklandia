import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

/**
 * Web App Manifest — Phase 1 PWA (installable shell).
 * Install prompt needs HTTPS + manifest + service worker (see public/sw.js).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0c0618',
    theme_color: '#1a0b2e',
    categories: ['games', 'entertainment'],
    lang: 'en',
    id: '/',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
