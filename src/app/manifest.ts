/**
 * @ai-description Web app manifest, so "Add to Home Screen" installs the app with its own icon
 * - Opens full screen (standalone) at /, which leads to the last opened collection
 * - Icons live in public/; the maskable one keeps the artwork inside the safe zone for round masks
 * - No service worker and no offline mode: installing only adds the icon and drops the browser frame
 */
import type { MetadataRoute } from 'next';
import { APP_TITLE } from '@/components/PageTitle';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    short_name: 'Collections',
    description: 'A modern interface to browse your MusicBrainz collection',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
