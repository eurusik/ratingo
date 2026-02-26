import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Ratingo — Трендові серіали та фільми',
    short_name: 'Ratingo',
    description: 'Відстежуйте тренди, рейтинги та нові епізоди серіалів і фільмів',
    lang: 'uk',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0D10',
    theme_color: '#0B0D10',
    categories: ['entertainment'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/desktop.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Головна сторінка Ratingo на десктопі',
      },
      {
        src: '/screenshots/mobile.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Головна сторінка Ratingo на мобільному',
      },
    ],
    shortcuts: [
      {
        name: 'Серіали у тренді',
        short_name: 'Серіали',
        url: '/browse/shows-trending',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Фільми у тренді',
        short_name: 'Фільми',
        url: '/browse/movies-trending',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Мій список',
        short_name: 'Список',
        url: '/saved',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
