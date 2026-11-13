import type { MetadataRoute } from 'next';

export const APP_THEME_COLOR = '#060607';

const APP_NAME = 'Ratingo';
const LAUNCHER_ICON = { src: '/icons/icon-192x192.png', sizes: '192x192' };

export function buildWebAppManifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Відстежуйте тренди, рейтинги та нові епізоди серіалів і фільмів',
    lang: 'uk',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: APP_THEME_COLOR,
    theme_color: APP_THEME_COLOR,
    categories: ['entertainment'],
    icons: [
      { ...LAUNCHER_ICON, type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
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
        icons: [LAUNCHER_ICON],
      },
      {
        name: 'Фільми у тренді',
        short_name: 'Фільми',
        url: '/browse/movies-trending',
        icons: [LAUNCHER_ICON],
      },
      { name: 'Мій список', short_name: 'Список', url: '/saved', icons: [LAUNCHER_ICON] },
    ],
  };
}
