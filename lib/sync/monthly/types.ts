/**
 * Типи для модуля monthly
 */

/**
 * Мапа переглядів {tmdbId: watchers}
 */
export interface WatchersMap {
  [tmdbId: number]: number;
}

/**
 * Мапи переглядів для 6 місяців (m0..m5)
 */
export interface MonthlyMaps {
  m0: WatchersMap;
  m1: WatchersMap;
  m2: WatchersMap;
  m3: WatchersMap;
  m4: WatchersMap;
  m5: WatchersMap;
}

/**
 * Дані перегляду з Trakt для шоу
 */
export interface TraktWatchedShow {
  show?: {
    ids?: {
      tmdb?: number;
    };
  };
  watchers?: number;
}

/**
 * Дані перегляду з Trakt для фільмів
 */
export interface TraktWatchedMovie {
  movie?: {
    ids?: {
      tmdb?: number;
    };
  };
  watchers?: number;
}
