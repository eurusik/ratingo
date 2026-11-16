import { HOME_ROUTE, MY_ROUTE } from '@/shared/config';

export const WHATS_NEW_STORAGE_KEY = 'ratingo:whats-new:v1';

export const WEB_CLIENT_STORAGE_KEYS = [
  'ratingo_access_token',
  'ratingo_refresh_token',
  'ratingo:dismissed-announcements-v2',
  'ratingo:calendar-mode',
] as const;

export const WEB_CLIENT_STORAGE_KEY_PREFIXES = ['ratingo:sync-queued:'] as const;

export const WHATS_NEW_ROUTES: readonly string[] = [HOME_ROUTE, MY_ROUTE];

export const WHATS_NEW_CALM_DELAY_MS = 1200;
