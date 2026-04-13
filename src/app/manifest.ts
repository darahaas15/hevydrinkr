import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/drinkr',
    name: 'Drinkr',
    short_name: 'Drinkr',
    description: 'Track your party sessions like a pro',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09090b',
    theme_color: '#14b8a6',
    categories: ['entertainment', 'social'],
    prefer_related_applications: false,
    // @ts-expect-error -- handle_links is a valid manifest field (Chrome 98+) but not yet in the TS type
    handle_links: 'preferred',
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Start Session',
        short_name: 'Sesh',
        url: '/session',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Feed',
        url: '/feed',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Groups',
        url: '/groups',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
