export type NavSection = 'today' | 'browse' | 'calendar' | 'my';

export interface NavRoute {
  section: NavSection;
  href: string;
}

export const HOME_ROUTE = '/';

export const NAV_ROUTES: readonly NavRoute[] = [
  { section: 'today', href: HOME_ROUTE },
  { section: 'browse', href: '/browse' },
  { section: 'calendar', href: '/calendar' },
  { section: 'my', href: '/my' },
];

export function isNavRouteActive(route: NavRoute, pathname: string): boolean {
  if (route.href === HOME_ROUTE) return pathname === HOME_ROUTE;
  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}
