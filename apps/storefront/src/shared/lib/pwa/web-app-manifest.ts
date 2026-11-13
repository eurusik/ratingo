import type { MetadataRoute } from 'next';
import { BRAND_NAME, BROWSE_ROUTE, CALENDAR_ROUTE, MY_ROUTE } from '@/shared/config';
import { DEFAULT_LOCALE, getDictionary } from '@/shared/i18n';

export const APP_THEME_COLOR = '#060607';

const LAUNCHER_ICON = { src: '/icons/icon-192x192.png', sizes: '192x192' };

export function buildWebAppManifest(): MetadataRoute.Manifest {
  const { nav } = getDictionary(DEFAULT_LOCALE);

  return {
    id: '/',
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: 'Відстежуйте тренди, рейтинги та нові епізоди серіалів і фільмів',
    lang: 'uk',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
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
      { name: nav.browse, url: BROWSE_ROUTE, icons: [LAUNCHER_ICON] },
      { name: nav.calendar, url: CALENDAR_ROUTE, icons: [LAUNCHER_ICON] },
      { name: nav.my, url: MY_ROUTE, icons: [LAUNCHER_ICON] },
    ],
  };
}
