/** Домен шоу - основні експорти */

// Експорти з upserts (базові функції роботи з шоу)
export * from './upserts';

// Експорти з processing (основна обробка шоу) - вибірково щоб уникнути конфліктів
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
  ProcessShowCacheConfig,
  ProcessShowCaches,
  ApiClientContext,
  ShowApiClients,
} from './processing';

export {
  processShow,
  extractSeasonEpisode,
  mergeProviders,
  isAnimeItem,
  prepareShowData,
  prepareRelatedShowData,
  calculateTrendingScore,
  computeDeltas,
  fetchTraktRatings,
  ensureRelatedShows,
  linkRelated,
  createProcessShowCaches,
  createShowApiClients,
} from './processing';

// Експорти з trending (трендові шоу)
export * from './trending';

// Експорти з backfill (заповнення метаданих)
export * from './backfill';
