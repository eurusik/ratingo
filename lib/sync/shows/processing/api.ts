/**
 * API клієнти для обробки шоу: TMDB, Trakt, OMDb з кешуванням та повторними спробами.
 *
 * @example
 * import { createShowApiClients } from '@/lib/sync/shows/processing/api';
 * const api = createShowApiClients(ctx.onRetryLabel, ctx.caches);
 * const details = await api.getShowDetails(tmdbId);
 */

import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { omdbClient } from '@/lib/api/omdb';
import { cachedWithRetry, withRetry } from '@/lib/sync/utils';
import type { ProcessShowCaches } from './caches';
import type {
  TMDBShowDetails,
  TMDBShowTranslation,
  TMDBExternalIds,
  WatchProvider,
  TMDBVideo,
  TMDBCastMember,
} from '@/lib/types';

/**
 * Контекст для API клієнтів з кешами та функціями повторних спроб.
 */
export interface ApiClientContext {
  /** Колекція кешів для різних типів даних */
  caches: ProcessShowCaches;
  /** Функція для створення обробників повторних спроб */
  onRetryLabel: (label: string) => (attempt: number, err: any) => void;
}

/**
 * API клієнти для роботи з шоу.
 */
export interface ShowApiClients {
  /** Отримує деталі шоу з TMDB */
  getShowDetails: (tmdbId: number) => Promise<TMDBShowDetails>;
  /** Отримує переклад шоу */
  getShowTranslation: (tmdbId: number) => Promise<TMDBShowTranslation>;
  /** Отримує провайдерів перегляду за регіоном */
  getWatchProviders: (tmdbId: number, region: string) => Promise<WatchProvider[]>;
  /** Отримує рейтинг вмісту за регіоном */
  getContentRating: (tmdbId: number, region: string) => Promise<string | null>;
  /** Отримує зовнішні ID шоу */
  getExternalIds: (tmdbId: number) => Promise<TMDBExternalIds>;
  /** Отримує відео шоу */
  getShowVideos: (tmdbId: number) => Promise<TMDBVideo[]>;
  /** Отримує агреговані кредити шоу */
  getShowCredits: (tmdbId: number) => Promise<TMDBCastMember[]>;
  /** Отримує рейтинги шоу з Trakt */
  getTraktRatings: (
    traktSlugOrId: string
  ) => Promise<{ rating: number; votes: number; distribution?: Record<string, number> }>;
  /** Отримує агреговані рейтинги з OMDb */
  getOmdbRatings: (
    imdbId: string
  ) => Promise<{
    imdbRating: number | null;
    imdbVotes: number | null;
    rottenTomatoes: number | null;
    metacritic: number | null;
    metascore: number | null;
  }>;
}

/**
 * Створює API клієнтів для обробки шоу.
 *
 * @param ctx Контекст з кешами та функціями повторних спроб
 * @returns Об'єкт з методами API клієнтів
 *
 * @example
 * const api = createShowApiClients({ caches, onRetryLabel });
 * const details = await api.getShowDetails(1399);
 */
export function createShowApiClients(ctx: ApiClientContext): ShowApiClients {
  const { caches, onRetryLabel } = ctx;

  return {
    /**
     * Отримує деталі шоу з TMDB з кешуванням.
     */
    getShowDetails: (tmdbId: number) =>
      cachedWithRetry(
        caches.tmdbDetailsCache,
        tmdbId,
        'tmdb.details',
        () => tmdbClient.getShowDetails(tmdbId),
        onRetryLabel('tmdb.details')
      ),

    /**
     * Отримує переклад шоу з TMDB з кешуванням.
     */
    getShowTranslation: (tmdbId: number) =>
      cachedWithRetry(
        caches.tmdbTranslationCache,
        tmdbId,
        'tmdb.translation',
        () => tmdbClient.getShowTranslation(tmdbId),
        onRetryLabel('tmdb.translation')
      ),

    /**
     * Отримує провайдерів перегляду за регіоном з кешуванням.
     */
    getWatchProviders: (tmdbId: number, region: string) =>
      cachedWithRetry(
        caches.tmdbProvidersCache,
        `${tmdbId}|${region}`,
        `tmdb.providers.${region}`,
        () => tmdbClient.getWatchProvidersByRegion(tmdbId, region),
        onRetryLabel(`tmdb.providers.${region}`)
      ),

    /**
     * Отримує рейтинг вмісту за регіоном з кешуванням.
     */
    getContentRating: (tmdbId: number, region: string) =>
      cachedWithRetry(
        caches.tmdbContentRatingCache,
        `${tmdbId}|${region}`,
        `tmdb.content.${region}`,
        () => tmdbClient.getContentRatingByRegion(tmdbId, region),
        onRetryLabel(`tmdb.content.${region}`)
      ),

    /**
     * Отримує зовнішні ID шоу з TMDB з кешуванням.
     */
    getExternalIds: (tmdbId: number) =>
      cachedWithRetry(
        caches.tmdbExternalIdsCache,
        tmdbId,
        'tmdb.externalIds',
        () => tmdbClient.getShowExternalIds(tmdbId),
        onRetryLabel('tmdb.externalIds')
      ),

    /**
     * Отримує відео шоу з TMDB.
     */
    getShowVideos: async (tmdbId: number) => {
      const response = await withRetry(
        () => tmdbClient.getShowVideos(tmdbId),
        3,
        300,
        onRetryLabel('tmdb.videos')
      );
      return response.results;
    },

    /**
     * Отримує агреговані кредити шоу з TMDB.
     */
    getShowCredits: (tmdbId: number) =>
      withRetry(() => tmdbClient.getAggregateCredits(tmdbId), 3, 300, onRetryLabel('tmdb.credits')),

    /**
     * Отримує рейтинги шоу з Trakt.
     */
    getTraktRatings: (traktSlugOrId: string) =>
      withRetry(
        () => traktClient.getShowRatings(traktSlugOrId),
        3,
        300,
        onRetryLabel('trakt.ratings')
      ),

    /**
     * Отримує агреговані рейтинги з OMDb.
     */
    getOmdbRatings: (imdbId: string) =>
      withRetry(() => omdbClient.getAggregatedRatings(imdbId), 3, 300, onRetryLabel('omdb.agg')),
  };
}

/**
 * Створює API клієнтів з типовими налаштуваннями.
 *
 * @param onRetryLabel Функція для створення обробників повторних спроб
 * @param caches Колекція кешів
 * @returns Об'єкт з методами API клієнтів
 *
 * @example
 * const api = createDefaultShowApiClients(onRetryLabel, caches);
 */
export function createDefaultShowApiClients(
  onRetryLabel: (label: string) => (attempt: number, err: any) => void,
  caches: ProcessShowCaches
): ShowApiClients {
  return createShowApiClients({ onRetryLabel, caches });
}
