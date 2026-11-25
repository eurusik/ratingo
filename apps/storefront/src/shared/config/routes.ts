export type MediaKind = 'movie' | 'show';

const MEDIA_ROUTE_PREFIXES: Record<MediaKind, string> = {
  movie: '/movies',
  show: '/shows',
};

export function mediaRoute(type: MediaKind, slug: string): string {
  return `${MEDIA_ROUTE_PREFIXES[type]}/${encodeURIComponent(slug)}`;
}

export const SHOW_SEASON_PARAM = 'season';

export const SHOW_PICK_VALUE = 'pick';

export function showSeasonRoute(slug: string, season?: number): string {
  const showRoute = mediaRoute('show', slug);
  return season === undefined ? showRoute : `${showRoute}?${SHOW_SEASON_PARAM}=${season}`;
}

export function showPickRoute(slug: string): string {
  return `${mediaRoute('show', slug)}?${SHOW_SEASON_PARAM}=${SHOW_PICK_VALUE}`;
}

export function mediaReviewsRoute(type: MediaKind, slug: string): string {
  return `${mediaRoute(type, slug)}/reviews`;
}

export function isMediaDetailsPath(pathname: string): boolean {
  return Object.values(MEDIA_ROUTE_PREFIXES).some((prefix) => pathname.startsWith(`${prefix}/`));
}

export const MY_ROUTE = '/my';

export const MY_LIST_PARAM = 'list';

export function myListRoute(list: string, defaultList: string): string {
  return list === defaultList ? MY_ROUTE : `${MY_ROUTE}?${MY_LIST_PARAM}=${list}`;
}

export const BROWSE_ROUTE = '/browse';
export const CALENDAR_ROUTE = '/calendar';
export const CALENDAR_TYPE_PARAM = 'type';
export const CALENDAR_MODE_PARAM = 'mode';
export const CALENDAR_PREMIERES_ROUTE = `${CALENDAR_ROUTE}?${CALENDAR_MODE_PARAM}=premieres`;
export const OFFLINE_ROUTE = '/~offline';
export const SETTINGS_ROUTE = '/settings';
export const PROFILE_SETTINGS_ROUTE = '/settings/profile';
export const SECURITY_SETTINGS_ROUTE = '/settings/security';
export const NOTIFICATION_SETTINGS_ROUTE = '/settings/notifications';
export const PRIVACY_SETTINGS_ROUTE = '/settings/privacy';
export const IMPORT_ROUTE = '/settings/import';
export const NOTIFICATIONS_ROUTE = '/notifications';
export const PUBLIC_PROFILE_ROUTE = '/u';

export function publicProfileRoute(username: string): string {
  return `${PUBLIC_PROFILE_ROUTE}/${encodeURIComponent(username)}`;
}

export function calendarRouteFor(type: 'show' | 'movie'): string {
  return type === 'show' ? CALENDAR_ROUTE : `${CALENDAR_ROUTE}?${CALENDAR_TYPE_PARAM}=${type}`;
}

export function isSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_ROUTE || pathname.startsWith(`${SETTINGS_ROUTE}/`);
}

export function isBrowsePath(pathname: string): boolean {
  return pathname === BROWSE_ROUTE || pathname.startsWith(`${BROWSE_ROUTE}/`);
}

export const EXTERNAL_LINKS = {
  github: 'https://github.com/eurusik/ratingo',
  author: 'https://eurusik.tech/',
} as const;
