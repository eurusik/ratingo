import { WHATS_NEW_ROUTES } from '../config/whats-new';

export function isWhatsNewEntryRoute(pathname: string | null): boolean {
  return pathname !== null && WHATS_NEW_ROUTES.includes(pathname);
}
