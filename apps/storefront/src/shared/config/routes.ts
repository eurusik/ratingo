type MediaKind = 'movie' | 'show';

const MEDIA_ROUTE_PREFIXES: Record<MediaKind, string> = {
  movie: '/movies',
  show: '/shows',
};

export function mediaRoute(type: MediaKind, slug: string): string {
  return `${MEDIA_ROUTE_PREFIXES[type]}/${encodeURIComponent(slug)}`;
}

export function isMediaDetailsPath(pathname: string): boolean {
  return Object.values(MEDIA_ROUTE_PREFIXES).some((prefix) => pathname.startsWith(`${prefix}/`));
}

export const MY_ROUTE = '/my';
export const BROWSE_ROUTE = '/browse';
export const CALENDAR_ROUTE = '/calendar';
export const OFFLINE_ROUTE = '/~offline';
export const SETTINGS_ROUTE = '/settings';
export const NOTIFICATIONS_ROUTE = '/notifications';
export const ABOUT_ROUTE = '/about';
export const JOURNAL_ROUTE = '/journal';

export const EXTERNAL_LINKS = {
  github: 'https://github.com/eurusik/ratingo',
  author: 'https://eurusik.tech/',
} as const;
