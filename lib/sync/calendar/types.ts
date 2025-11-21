/**
 * Типи для модуля calendar
 */

/**
 * Результат синхронізації календаря
 */
export interface CalendarSyncResult {
  processed: number;
  inserted: number;
  updated: number;
}

/**
 * Результат очищення застарілих записів
 */
export interface PruneResult {
  deleted: number;
  cutoffDate: string;
}

/**
 * Налаштування календаря
 */
export interface CalendarConfig {
  startDate: string;
  days: number;
}

/**
 * Дані ефіру з Trakt
 */
export interface TraktAiringData {
  show?: {
    title?: string;
    ids?: {
      tmdb?: number;
      trakt?: number;
    };
    network?: string;
  };
  episode?: {
    season?: number;
    number?: number;
    title?: string;
  };
  first_aired?: string;
}

/**
 * Дані для вставки/оновлення ефіру
 */
export interface AiringData {
  showId: number | null;
  tmdbId: number;
  traktId: number | null;
  title: string | null;
  episodeTitle: string | null;
  season: number | null;
  episode: number | null;
  airDate: string | null;
  network: string | null;
  type: 'episode';
}
