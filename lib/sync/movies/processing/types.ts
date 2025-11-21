/**
 * Типи для обробки фільмів.
 */

import type { MonthlyMaps } from '@/lib/sync/types';
import type { LRUCache } from '@/lib/sync/utils';
import type {
  TMDBMovieDetails,
  TMDBMovieTranslation,
  WatchProvider,
  TMDBExternalIds,
} from '@/lib/types';

/**
 * Контекст обробки фільму.
 * Містить кеші TMDB, мапи популярності та максимальну кількість глядачів.
 */
export type ProcessMovieContext = {
  monthly: MonthlyMaps;
  maxWatchers: number;
  tmdbDetailsCache: LRUCache<number, TMDBMovieDetails>;
  tmdbTranslationCache: LRUCache<number, TMDBMovieTranslation>;
  tmdbProvidersCache: LRUCache<string, WatchProvider[]>;
  tmdbExternalIdsCache: LRUCache<number, TMDBExternalIds>;
};

/**
 * Результат обробки фільму.
 * Містить статистику оновлень, додавань та знімків.
 */
export type ProcessMovieResult = {
  updated: number;
  added: number;
  skipped: boolean;
  ratingsUpdated: number;
  bucketsUpserted: number;
  snapshotsInserted: number;
  snapshotsUnchanged: number;
  snapshotsProcessed: number;
  error?: string;
};

/**
 * Елемент фільму з Trakt.
 */
export type TraktMovieItem = {
  watchers?: number;
  movie: {
    title?: string | null;
    ids: {
      trakt?: number;
      slug?: string;
      imdb?: string | null;
      tmdb?: number;
    };
  };
};
