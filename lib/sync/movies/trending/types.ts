/**
 * @fileoverview Типи для trending movies processor
 */

/**
 * Результат роботи trending movies processor
 */
export interface TrendingMoviesProcessorResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Задача синхронізації з БД
 */
export interface SyncTask {
  id: number;
  jobId: number;
  tmdbId: number;
  payload: any;
  attempts?: number;
}

/**
 * Дані Trakt фільму
 */
export interface TraktMovieData {
  watchers?: number;
  movie: {
    ids: { tmdb: number };
    title?: string | null;
    [key: string]: any;
  };
}

/**
 * Параметри для обробки фільму
 */
export interface MovieProcessingOptions {
  monthly: any;
  maxWatchers: number;
  tmdbDetailsCache: any;
  tmdbTranslationCache: any;
  tmdbProvidersCache: any;
  tmdbExternalIdsCache: any;
}

/**
 * Контейнер кешів для трендових фільмів
 */
export interface TrendingMoviesCache {
  details: any; // LRUCache для деталей фільмів
  translations: any; // LRUCache для перекладів
  providers: any; // LRUCache для провайдерів перегляду
  externalIds: any; // LRUCache для зовнішніх ID
}

/**
 * Трендовий фільм з Trakt
 */
export interface TraktTrendingMovie {
  watchers?: number;
  movie: {
    ids: { tmdb: number };
    title?: string | null;
    [key: string]: any;
  };
}

/**
 * Дані задачі для обробки фільму
 */
export interface TaskData {
  jobId: number;
  tmdbId: number;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Параметри для отримання трендових фільмів з Trakt
 */
export interface TraktTrendingOptions {
  limit?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Результат обробки фільму
 */
export interface MovieProcessingResult {
  success: boolean;
  movieId?: number;
  error?: string;
  skipped?: boolean;
  updated?: number;
  added?: number;
  ratingsUpdated?: number;
  bucketsUpserted?: number;
  snapshotsInserted?: number;
  snapshotsUnchanged?: number;
  snapshotsProcessed?: number;
}

/**
 * Статус обробки фільму
 */
export type MovieStatus = 'pending' | 'processing' | 'completed' | 'failed';
