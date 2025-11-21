/**
 * Пер- шоу обробка: збагачує дані шоу з TMDB/Trakt/OMDb,
 * оновлює нормалізовані таблиці й обчислює метрики (тренд, дельти).
 *
 * @example
 * import { processShow } from '@/lib/sync/processShow';
 * import { createProcessShowCaches } from '@/lib/sync/processShow';
 * const ctx = {
 *   monthly: { m0:{}, m1:{}, m2:{}, m3:{}, m4:{}, m5:{} },
 *   maxWatchers: 10000,
 *   animeKeywords: ['anime', 'аніме'],
 *   ...createProcessShowCaches(),
 *   currentTrendingTmdbIds: new Set(),
 *   onRetryLabel: () => () => {}
 * };
 * const traktItem = { watchers: 1234, show: { ids: { tmdb: 1399 }, title: 'Example' } };
 * const res = await processShow(traktItem, ctx);
 * console.log(res.updated, res.added);
 */

// Реекспортуємо всі функції з нової модульної структури
export {
  // Основна функція
  processShow,

  // Робота з пов'язаними шоу
  ensureRelatedShows,
  linkRelated,

  // Типи
  type ProcessShowContext,
  type ProcessShowResult,
  type ProcessShowCacheConfig,
  type ProcessShowCaches,
  type ApiClientContext,
  type ShowApiClients,
  type ShowDetailsAndTranslation,
  type ProvidersAndContent,
  type VideosAndCast,
  type OmdbAggregatedRatings,
  type TraktShowRatings,
  type TrendingMetrics,
  type SeasonEpisodeInfo,
  type RelatedShowParams,
  type ShowUpdateData,

  // Кеш-менеджмент
  createProcessShowCaches,

  // API клієнти
  createShowApiClients,

  // Обробка даних
  extractSeasonEpisode,
  mergeProviders,
  isAnimeItem,
  prepareShowData,
  prepareRelatedShowData,

  // Обчислення метрик
  calculateTrendingScore,
  computeDeltas,
  fetchTraktRatings,

  // Робота з БД
  upsertShow,
  upsertShowRatings,
  upsertShowWatchProviders,
  upsertShowRatingBuckets,
  upsertShowWatchersSnapshot,
} from './shows/processing/index';
