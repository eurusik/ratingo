/**
 * Головний модуль обробки шоу - експортує всі функції та типи для роботи з шоу.
 *
 * @module shows/processing
 * @example
 * ```typescript
 * import { processShow, createProcessShowCaches } from '@/lib/sync/shows/processing';
 *
 * const ctx = {
 *   monthly: { m0:{}, m1:{}, m2:{}, m3:{}, m4:{}, m5:{} },
 *   maxWatchers: 10000,
 *   animeKeywords: ['аніме', 'anime'],
 *   ...createProcessShowCaches()
 * };
 *
 * const result = await processShow(traktItem, ctx);
 * ```
 */

// Основні типи та інтерфейси
export type {
  ProcessShowContext,
  ProcessShowResult,
  ShowDetailsAndTranslation,
  ProvidersAndContent,
  VideosAndCast,
  OmdbAggregatedRatings,
  TraktShowRatings,
  TrendingMetrics,
  SeasonEpisodeInfo,
  RelatedShowParams,
  ShowUpdateData,
} from './types';

// Типи кешів (уникаємо повторного експортування дубльованих інтерфейсів)
export type { ProcessShowCacheConfig, ProcessShowCaches } from './caches';

// Типи API
export type { ApiClientContext, ShowApiClients } from './api';

// Головна функція обробки
export { processShow } from './main';

// Утилітарні функції
export {
  extractSeasonEpisode,
  mergeProviders,
  isAnimeItem,
  prepareShowData,
  prepareRelatedShowData,
} from './processing';

// Функції обчислення метрик
export { calculateTrendingScore, computeDeltas, fetchTraktRatings } from './metrics';

// Функції роботи з базою даних
export {
  upsertShow,
  upsertShowRatings,
  upsertShowWatchProviders,
  upsertShowRatingBuckets,
  upsertShowWatchersSnapshot,
} from './database';

// Функції роботи з пов'язаними шоу
export { ensureRelatedShows, linkRelated } from './related';

// Створення кешів
export { createProcessShowCaches } from './caches';

// Створення API клієнтів
export { createShowApiClients } from './api';
