/**
 * @fileoverview Типи та інтерфейси для модуля обробки шоу
 *
 * Модуль відповідає за типізацію всіх структур даних,
 * що використовуються при обробці та синхронізації шоу.
 *
 * @author Твій Асистент
 */

import type { LRUCache } from '@/lib/sync/utils';
import type { MonthlyMaps } from '@/lib/sync/types';
import type {
  TMDBVideo,
  WatchProvider,
  TMDBShowDetails,
  TMDBCastMember,
  TMDBShowTranslation,
  TMDBExternalIds,
} from '@/lib/types';

/**
 * Контекст обробки одного шоу: кеші, конфіг та агрегації.
 *
 * @example
 * ```typescript
 * const ctx: ProcessShowContext = {
 *   monthly: { m0:{}, m1:{}, m2:{}, m3:{}, m4:{}, m5:{} },
 *   maxWatchers: 10000,
 *   animeKeywords: ['anime', 'аніме'],
 *   tmdbDetailsCache: new LRUCache(300),
 *   tmdbTranslationCache: new LRUCache(300),
 *   tmdbProvidersCache: new LRUCache(400),
 *   tmdbContentRatingCache: new LRUCache(400),
 *   tmdbExternalIdsCache: new LRUCache(400),
 *   currentTrendingTmdbIds: new Set(),
 *   onRetryLabel: () => () => {}
 * };
 * ```
 */
export interface ProcessShowContext {
  /** Місячні мапи для аналізу трендів */
  monthly: MonthlyMaps;
  /** Максимальна кількість глядачів для нормалізації */
  maxWatchers: number;
  /** Ключові слова для визначення аніме */
  animeKeywords: string[];
  /** Кеш деталей шоу з TMDB */
  tmdbDetailsCache: LRUCache<number, TMDBShowDetails>;
  /** Кеш перекладів шоу */
  tmdbTranslationCache: LRUCache<number, TMDBShowTranslation>;
  /** Кеш провайдерів перегляду */
  tmdbProvidersCache: LRUCache<string, WatchProvider[]>;
  /** Кеш контент-рейтингів */
  tmdbContentRatingCache: LRUCache<string, string | null>;
  /** Кеш зовнішніх ID */
  tmdbExternalIdsCache: LRUCache<number, TMDBExternalIds>;
  /** Набір поточних трендових TMDB ID */
  currentTrendingTmdbIds: Set<number>;
  /** Функція для створення обробників повторних спроб */
  onRetryLabel: (label: string) => (attempt: number, err: any) => void;
}

/**
 * Результат обробки: лічильники змін і діагностика.
 *
 * @example
 * ```typescript
 * const result: ProcessShowResult = {
 *   updated: 1,
 *   added: 0,
 *   skipped: false,
 *   ratingsUpdated: 1,
 *   bucketsUpserted: 2,
 *   snapshotsInserted: 1,
 *   snapshotsUnchanged: 0,
 *   snapshotsProcessed: 1,
 *   relatedShowsInserted: 3,
 *   relatedLinksAdded: 5,
 *   relatedSourceCounts: { trakt: 2, tmdb: 3 },
 *   relatedShowsWithCandidates: 1
 * };
 * ```
 */
export interface ProcessShowResult {
  /** Кількість оновлених записів */
  updated: number;
  /** Кількість доданих записів */
  added: number;
  /** Чи було шоу пропущено */
  skipped: boolean;
  /** Кількість оновлених рейтингів */
  ratingsUpdated: number;
  /** Кількість доданих/оновлених відер рейтингів */
  bucketsUpserted: number;
  /** Кількість вставлених знімків */
  snapshotsInserted: number;
  /** Кількість незмінених знімків */
  snapshotsUnchanged: number;
  /** Кількість оброблених знімків */
  snapshotsProcessed: number;
  /** Кількість доданих пов'язаних шоу */
  relatedShowsInserted: number;
  /** Кількість доданих посилань на пов'язані шоу */
  relatedLinksAdded: number;
  /** Статистика за джерелами пов'язаних шоу */
  relatedSourceCounts: { trakt: number; tmdb: number };
  /** Чи є у шоу кандидати на пов'язані (0/1 прапорець) */
  relatedShowsWithCandidates: number;
  /** Загальна кількість кандидатів на пов'язані шоу */
  relatedCandidatesTotal: number;
  /** Повідомлення про помилку, якщо є */
  error?: string;
}

/**
 * Деталі та переклад шоу з TMDB.
 *
 * @example
 * ```typescript
 * const data: ShowDetailsAndTranslation = {
 *   tmdbShowData: showDetails,
 *   ukTranslation: ukrainianTranslation
 * };
 * ```
 */
export interface ShowDetailsAndTranslation {
  /** Деталі шоу з TMDB */
  tmdbShowData: TMDBShowDetails;
  /** Переклад українською (може бути null) */
  ukTranslation: TMDBShowTranslation | null;
}

/**
 * Провайдери перегляду та контент-рейтинги для регіонів.
 *
 * @example
 * ```typescript
 * const providers: ProvidersAndContent = {
 *   watchProvidersUa: uaProviders,
 *   watchProvidersUs: usProviders,
 *   contentRatingUa: '16+',
 *   contentRatingUs: 'TV-MA'
 * };
 * ```
 */
export interface ProvidersAndContent {
  /** Провайдери перегляду для України */
  watchProvidersUa: WatchProvider[];
  /** Провайдери перегляду для США */
  watchProvidersUs: WatchProvider[];
  /** Контент-рейтинг для України */
  contentRatingUa: string | null;
  /** Контент-рейтинг для США */
  contentRatingUs: string | null;
}

/**
 * Відео та акторський склад шоу.
 *
 * @example
 * ```typescript
 * const media: VideosAndCast = {
 *   videosPreferred: trailers,
 *   cast: mainActors
 * };
 * ```
 */
export interface VideosAndCast {
  /** Відібрані відео (трейлери, тизери тощо) */
  videosPreferred: TMDBVideo[];
  /** Акторський склад (до 12 осіб) */
  cast: TMDBCastMember[];
}

/**
 * Агреговані рейтинги з OMDb.
 *
 * @example
 * ```typescript
 * const ratings: OmdbAggregatedRatings = {
 *   imdbRating: 8.5,
 *   imdbVotes: 125000,
 *   ratingMetacritic: 85
 * };
 * ```
 */
export interface OmdbAggregatedRatings {
  /** Рейтинг IMDb */
  imdbRating: number | null;
  /** Кількість голосів IMDb */
  imdbVotes: number | null;
  /** Рейтинг Metacritic */
  ratingMetacritic: number | null;
}

/**
 * Рейтинги Trakt для шоу.
 *
 * @example
 * ```typescript
 * const ratings: TraktShowRatings = {
 *   ratingTraktAvg: 8.2,
 *   ratingTraktVotes: 45000,
 *   ratingDistribution: { '1': 100, '2': 200, '10': 5000 }
 * };
 * ```
 */
export interface TraktShowRatings {
  /** Середній рейтинг Trakt */
  ratingTraktAvg: number | null;
  /** Кількість голосів Trakt */
  ratingTraktVotes: number | null;
  /** Дистрибуція рейтингів 1-10 */
  ratingDistribution?: Record<string, number>;
}

/**
 * Трендовий скор та дельти популярності.
 *
 * @example
 * ```typescript
 * const metrics: TrendingMetrics = {
 *   trendingScore: 75.5,
 *   delta3mVal: 1200,
 *   watchersDelta: 350
 * };
 * ```
 */
export interface TrendingMetrics {
  /** Обчислений трендовий скор */
  trendingScore: number;
  /** Дельта за 3 місяці */
  delta3mVal: number;
  /** Дельта глядачів */
  watchersDelta: number;
}

/**
 * Інформація про сезони та епізоди.
 *
 * @example
 * ```typescript
 * const seasons: SeasonEpisodeInfo = {
 *   latestSeasonNumber: 3,
 *   latestSeasonEpisodes: 10,
 *   lastEpisodeSeason: 3,
 *   lastEpisodeNumber: 10,
 *   lastEpisodeAirDate: '2024-12-01',
 *   nextEpisodeSeason: null,
 *   nextEpisodeNumber: null,
 *   nextEpisodeAirDate: null
 * };
 * ```
 */
export interface SeasonEpisodeInfo {
  /** Номер останнього сезону */
  latestSeasonNumber: number | null;
  /** Кількість епізодів в останньому сезоні */
  latestSeasonEpisodes: number | null;
  /** Номер сезону останнього епізоду */
  lastEpisodeSeason: number | null;
  /** Номер останнього епізоду */
  lastEpisodeNumber: number | null;
  /** Дата виходу останнього епізоду */
  lastEpisodeAirDate: string | null;
  /** Номер сезону наступного епізоду */
  nextEpisodeSeason: number | null;
  /** Номер наступного епізоду */
  nextEpisodeNumber: number | null;
  /** Дата виходу наступного епізоду */
  nextEpisodeAirDate: string | null;
}

/**
 * Параметри для обробки пов'язаних шоу.
 *
 * @example
 * ```typescript
 * const params: RelatedShowParams = {
 *   relatedTmdbIds: [123, 456, 789],
 *   relatedSource: 'tmdb'
 * };
 * ```
 */
export interface RelatedShowParams {
  /** Масив TMDB ID пов'язаних шоу */
  relatedTmdbIds: number[];
  /** Джерело пов'язаних шоу ('trakt' або 'tmdb') */
  relatedSource: 'trakt' | 'tmdb';
}

/**
 * Конфігурація кешів для обробки шоу.
 *
 * @example
 * ```typescript
 * const config: ProcessShowCacheConfig = {
 *   detailsCacheSize: 300,
 *   translationCacheSize: 300,
 *   providersCacheSize: 400,
 *   contentRatingCacheSize: 400,
 *   externalIdsCacheSize: 400
 * };
 * ```
 */
export interface ProcessShowCacheConfig {
  /** Розмір кешу деталей шоу */
  detailsCacheSize?: number;
  /** Розмір кешу перекладів */
  translationCacheSize?: number;
  /** Розмір кешу провайдерів */
  providersCacheSize?: number;
  /** Розмір кешу контент-рейтингів */
  contentRatingCacheSize?: number;
  /** Розмір кешу зовнішніх ID */
  externalIdsCacheSize?: number;
}

/**
 * Набір кешів для обробки шоу.
 *
 * @example
 * ```typescript
 * const caches: ProcessShowCaches = {
 *   tmdbDetailsCache: new LRUCache(300),
 *   tmdbTranslationCache: new LRUCache(300),
 *   tmdbProvidersCache: new LRUCache(400),
 *   tmdbContentRatingCache: new LRUCache(400),
 *   tmdbExternalIdsCache: new LRUCache(400)
 * };
 * ```
 */
export interface ProcessShowCaches {
  /** Кеш деталей шоу з TMDB */
  tmdbDetailsCache: LRUCache<number, TMDBShowDetails>;
  /** Кеш перекладів шоу */
  tmdbTranslationCache: LRUCache<number, TMDBShowTranslation>;
  /** Кеш провайдерів перегляду */
  tmdbProvidersCache: LRUCache<string, WatchProvider[]>;
  /** Кеш контент-рейтингів */
  tmdbContentRatingCache: LRUCache<string, string | null>;
  /** Кеш зовнішніх ID */
  tmdbExternalIdsCache: LRUCache<number, TMDBExternalIds>;
}

/**
 * Контекст API клієнтів для обробки шоу.
 *
 * @example
 * ```typescript
 * const context: ApiClientContext = {
 *   caches: processShowCaches,
 *   onRetryLabel: () => {}
 * };
 * ```
 */
export interface ApiClientContext {
  /** Набір кешів для API запитів */
  caches: ProcessShowCaches;
  /** Функція для створення обробників повторних спроб */
  onRetryLabel: (label: string) => (attempt: number, err: any) => void;
}

/**
 * API клієнти для роботи з шоу.
 *
 * @example
 * ```typescript
 * const clients: ShowApiClients = {
 *   getShowDetails: async (tmdbId) => showDetails,
 *   getShowVideos: async (tmdbId) => videos,
 *   getShowTranslation: async (tmdbId) => translation,
 *   getShowProviders: async (tmdbId, country) => providers,
 *   getShowContentRating: async (tmdbId, country) => rating,
 *   getShowExternalIds: async (tmdbId) => externalIds,
 *   getShowCast: async (tmdbId) => cast,
 *   fetchTraktRatings: async (traktSlugOrId) => ratings
 * };
 * ```
 */
export interface ShowApiClients {
  /** Отримати деталі шоу */
  getShowDetails: (tmdbId: number) => Promise<TMDBShowDetails | null>;
  /** Отримати відео шоу */
  getShowVideos: (tmdbId: number) => Promise<TMDBVideo[]>;
  /** Отримати переклад шоу */
  getShowTranslation: (tmdbId: number) => Promise<TMDBShowTranslation | null>;
  /** Отримати провайдерів перегляду */
  getShowProviders: (tmdbId: number, country: string) => Promise<WatchProvider[] | null>;
  /** Отримати контент-рейтинг */
  getShowContentRating: (tmdbId: number, country: string) => Promise<string | null>;
  /** Отримати зовнішні ID */
  getShowExternalIds: (tmdbId: number) => Promise<TMDBExternalIds | null>;
  /** Отримати акторський склад */
  getShowCast: (tmdbId: number) => Promise<TMDBCastMember[] | null>;
  /** Отримати рейтинги Trakt */
  fetchTraktRatings: (traktSlugOrId: any) => Promise<{
    ratingTraktAvg: number | null;
    ratingTraktVotes: number | null;
    ratingDistribution?: Record<string, number>;
  }>;
}

/**
 * Повні дані для оновлення шоу в БД.
 *
 * @example
 * ```typescript
 * const showData: ShowUpdateData = {
 *   title: 'Game of Thrones',
 *   titleUk: 'Гра престолів',
 *   overview: 'Epic fantasy series...',
 *   overviewUk: 'Епічний фентезі-серіал...',
 *   // ... інші поля
 * };
 * ```
 */
export interface ShowUpdateData {
  /** Назва шоу */
  title: string;
  /** Назва українською */
  titleUk: string | null;
  /** Опис шоу */
  overview: string | null;
  /** Опис українською */
  overviewUk: string | null;
  /** Постер шоу */
  poster: string | null;
  /** Постер українською */
  posterUk: string | null;
  /** Фонове зображення */
  backdrop: string | null;
  /** Рейтинг TMDB */
  ratingTmdb: number | null;
  /** Кількість голосів TMDB */
  ratingTmdbCount: number | null;
  /** Популярність TMDB */
  popularityTmdb: number | null;
  /** Рейтинг IMDb */
  ratingImdb: number | null;
  /** Кількість голосів IMDb */
  imdbVotes: number | null;
  /** Рейтинг Metacritic */
  ratingMetacritic: number | null;
  /** Первинний рейтинг для сортування */
  primaryRating: number | null;
  /** Перша дата виходу */
  firstAirDate: string | null;
  /** Остання дата виходу */
  lastAirDate: string | null;
  /** Кількість сезонів */
  numberOfSeasons: number | null;
  /** Кількість епізодів */
  numberOfEpisodes: number | null;
  /** Статус шоу */
  status: string | null;
  /** Слоган шоу */
  tagline: string | null;
  /** Чи є аніме */
  isAnime: boolean;
  /** Трендовий скор */
  trendingScore: number;
  /** Дельта глядачів */
  watchersDelta: number;
  /** Дельта за 3 місяці */
  delta3mVal: number;
  /** Номер останнього сезону */
  latestSeasonNumber: number | null;
  /** Кількість епізодів в останньому сезоні */
  latestSeasonEpisodes: number | null;
  /** Номер сезону останнього епізоду */
  lastEpisodeSeason: number | null;
  /** Номер останнього епізоду */
  lastEpisodeNumber: number | null;
  /** Дата виходу останнього епізоду */
  lastEpisodeAirDate: string | null;
  /** Номер сезону наступного епізоду */
  nextEpisodeSeason: number | null;
  /** Номер наступного епізоду */
  nextEpisodeNumber: number | null;
  /** Дата виходу наступного епізоду */
  nextEpisodeAirDate: string | null;
  /** Контент-рейтинг */
  contentRating: string | null;
  /** Провайдери перегляду */
  watchProviders: WatchProvider[];
  /** Акторський склад */
  cast: TMDBCastMember[];
  /** Пов'язані шоу */
  related: number[];
  /** Дата останнього оновлення трендів */
  trendingUpdatedAt: Date;
  /** Дата оновлення */
  updatedAt: Date;
}
