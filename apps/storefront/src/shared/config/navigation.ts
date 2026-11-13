import { BROWSE_ROUTE, CALENDAR_ROUTE, MY_ROUTE } from './routes';

export type NavSection = 'today' | 'browse' | 'calendar' | 'my';

export interface NavRoute {
  section: NavSection;
  href: string;
}

export const HOME_ROUTE = '/';

export const NAV_ROUTES: readonly NavRoute[] = [
  { section: 'today', href: HOME_ROUTE },
  { section: 'browse', href: BROWSE_ROUTE },
  { section: 'calendar', href: CALENDAR_ROUTE },
  { section: 'my', href: MY_ROUTE },
];

export function isNavRouteActive(route: NavRoute, pathname: string): boolean {
  if (route.href === HOME_ROUTE) return pathname === HOME_ROUTE;
  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}
