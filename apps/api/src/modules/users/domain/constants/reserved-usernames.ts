export const RESERVED_USERNAMES = [
  'me',
  'ratings',
  'watchlist',
  'history',
  'admin',
  'api',
  'settings',
  'profile',
  'search',
  'trending',
  'home',
] as const;

export type ReservedUsername = (typeof RESERVED_USERNAMES)[number];
