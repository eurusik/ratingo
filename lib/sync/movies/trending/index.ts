/**
 * @fileoverview Головний модуль для управління трендовими фільмами
 *
 * Цей модуль об'єднує функціональність для роботи з трендовими фільмами:
 * - координація синхронізації
 * - обробка задач
 * - кешування даних
 * - синхронізація з Trakt API
 *
 * @module movies/trending
 */

import { createTrendingMoviesCache } from './caches';
import { getTrendingMovies, convertMoviesToTaskData } from './movies';
import { createSyncJob } from './job';
import { getPendingTasks } from './tasks';
import { processMoviesBatch } from './processing';
import { filterValidTraktMovies } from './trakt';

// ========== ТИПИ ТА ІНТЕРФЕЙСИ ==========

// Доступні типи з consolidated types
export type {
  TrendingMoviesProcessorResult,
  SyncTask,
  TraktMovieData,
  MovieProcessingOptions,
  TrendingMoviesCache,
  TraktTrendingMovie,
  TaskData,
  TraktTrendingOptions,
  MovieProcessingResult,
  MovieStatus,
} from './types';

// ========== ГОЛОВНІ ФУНКЦІЇ ==========

// Головна функція синхронізації трендових фільмів
export async function runTrendingMoviesSync(
  syncOptions: {
    limit?: number;
    concurrency?: number;
    staleMinutes?: number;
    maxWatchers?: number;
  } = {}
): Promise<any> {
  const cache = createTrendingMoviesCache();
  const limit = syncOptions.limit || 100;
  const movies = await getTrendingMovies(limit);
  const validMovies = filterValidTraktMovies(movies);
  const jobId = await createSyncJob();
  const taskData = convertMoviesToTaskData(validMovies, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').MovieProcessingOptions = {
    monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
    maxWatchers: syncOptions.maxWatchers || 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо фільми партіями
  const results = await processMoviesBatch(validMovies, processingOptions);

  return {
    success: true,
    processed: results.length,
    timestamp: new Date(),
  };
}

// Інкрементальна синхронізація
export async function runTrendingMoviesIncremental(
  limit: number = 10,
  staleMinutes: number = 5
): Promise<any> {
  const cache = createTrendingMoviesCache();
  const movies = await getTrendingMovies(limit);
  const validMovies = filterValidTraktMovies(movies);
  const jobId = await createSyncJob();
  const taskData = convertMoviesToTaskData(validMovies, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').MovieProcessingOptions = {
    monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
    maxWatchers: 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо фільми партіями
  const results = await processMoviesBatch(validMovies, processingOptions);

  return {
    success: true,
    processed: results.length,
    timestamp: new Date(),
  };
}

// Координатор синхронізації
export async function runTrendingMoviesCoordinator(): Promise<any> {
  const cache = createTrendingMoviesCache();
  const movies = await getTrendingMovies(20);
  const validMovies = filterValidTraktMovies(movies);
  const jobId = await createSyncJob();
  const taskData = convertMoviesToTaskData(validMovies, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').MovieProcessingOptions = {
    monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
    maxWatchers: 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо фільми партіями
  const results = await processMoviesBatch(validMovies, processingOptions);

  return {
    success: true,
    processed: results.length,
    timestamp: new Date(),
  };
}

// Процесор трендових фільмів
export async function runTrendingMoviesProcessor(limit: number = 10): Promise<any> {
  const cache = createTrendingMoviesCache();
  const movies = await getTrendingMovies(limit);
  const validMovies = filterValidTraktMovies(movies);
  const jobId = await createSyncJob();
  const taskData = convertMoviesToTaskData(validMovies, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').MovieProcessingOptions = {
    monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
    maxWatchers: 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо фільми партіями
  const results = await processMoviesBatch(validMovies, processingOptions);

  return {
    success: true,
    processed: results.length,
    timestamp: new Date(),
  };
}

// Отримати статус синхронізації
export async function getSyncStatus(): Promise<any> {
  const pendingTasks = await getPendingTasks(10);
  return {
    hasPendingTasks: pendingTasks.length > 0,
    pendingCount: pendingTasks.length,
    timestamp: new Date(),
  };
}

// Ініціалізувати кеші
export function initializeCaches() {
  return createTrendingMoviesCache();
}

// ========== ФУНКЦІЇ ПРОЦЕСОРА ==========

export { processMovieTask } from './processor';

// ========== ФУНКЦІЇ КООРДИНАТОРА ==========

export { createSyncJob, updateJobStats } from './job';

// ========== УПРАВЛІННЯ КЕШАМИ ==========

export { createTrendingMoviesCache, clearTrendingMoviesCache, getCacheStats } from './caches';

// ========== РОБОТА З TRAKT API ==========

export { fetchTraktTrendingMovies, validateTraktMovieData, filterValidTraktMovies } from './trakt';

// ========== ОБРОБКА ФІЛЬМІВ ==========

export { processMoviesBatch, aggregateResults } from './processing';

// ========== УПРАВЛІННЯ ЗАДАЧАМИ ==========

export {
  getPendingTasks,
  updateTaskToProcessing,
  updateTaskToDone,
  updateTaskToError,
  createTasksBatch,
} from './tasks';

export { getTrendingMovies, convertMoviesToTaskData } from './movies';
