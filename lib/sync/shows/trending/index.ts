/**
 * @fileoverview Головний модуль для управління трендовими шоу
 *
 * Цей модуль об'єднує функціональність для роботи з трендовими шоу:
 * - координація синхронізації
 * - обробка задач
 * - кешування даних
 * - синхронізація з Trakt API
 *
 * @module shows/trending
 */

import { createTrendingShowsCache } from './caches';
import { getTrendingShows, filterValidTraktShows, convertShowsToTaskData } from './shows';
import { createSyncJob } from './job';
import { getPendingTasks } from './tasks';
import { processShowsBatch } from './processing';

// ========== ТИПИ ТА ІНТЕРФЕЙСИ ==========

// Доступні типи з consolidated types
export type {
  TrendingShowsCache,
  ShowProcessingOptions,
  ShowProcessingResult,
  TaskData,
  SyncTask,
  SyncJob,
  TraktTrendingOptions,
  TraktShowData,
  ShowStatus,
} from './types';

// ========== ГОЛОВНІ ФУНКЦІЇ ==========

// Головна функція синхронізації трендових шоу
export async function runTrendingShowsSync(
  syncOptions: {
    limit?: number;
    concurrency?: number;
    staleMinutes?: number;
    maxWatchers?: number;
  } = {}
): Promise<any> {
  const cache = createTrendingShowsCache();
  const limit = syncOptions.limit || 100;
  const shows = await getTrendingShows(limit);
  const validShows = filterValidTraktShows(shows);
  const jobId = await createSyncJob();
  const taskData = convertShowsToTaskData(validShows, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').ShowProcessingOptions = {
    monthly: {},
    maxWatchers: syncOptions.maxWatchers || 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо шоу партіями
  const results = await processShowsBatch(taskData, processingOptions, syncOptions.concurrency);

  return {
    success: true,
    processed: results.length,
    timestamp: new Date(),
  };
}

// Інкрементальна синхронізація
export async function runTrendingShowsIncremental(
  limit: number = 10,
  staleMinutes: number = 5
): Promise<any> {
  const cache = createTrendingShowsCache();
  const shows = await getTrendingShows(limit);
  const validShows = filterValidTraktShows(shows);
  const jobId = await createSyncJob();
  const taskData = convertShowsToTaskData(validShows, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').ShowProcessingOptions = {
    monthly: {},
    maxWatchers: 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо шоу партіями
  const results = await processShowsBatch(taskData, processingOptions);

  return {
    success: true,
    processed: results.length,
    timestamp: new Date(),
  };
}

// Координатор синхронізації
export async function runTrendingShowsCoordinator(): Promise<any> {
  const cache = createTrendingShowsCache();
  const shows = await getTrendingShows(20);
  const validShows = filterValidTraktShows(shows);
  const jobId = await createSyncJob();
  const taskData = convertShowsToTaskData(validShows, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').ShowProcessingOptions = {
    monthly: {},
    maxWatchers: 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо шоу партіями
  const results = await processShowsBatch(taskData, processingOptions);

  return {
    success: true,
    processed: results.length,
    timestamp: new Date(),
  };
}

// Процесор трендових шоу
export async function runTrendingShowsProcessor(limit: number = 10): Promise<any> {
  const cache = createTrendingShowsCache();
  const shows = await getTrendingShows(limit);
  const validShows = filterValidTraktShows(shows);
  const jobId = await createSyncJob();
  const taskData = convertShowsToTaskData(validShows, jobId);

  // Створюємо параметри обробки
  const processingOptions: import('./types').ShowProcessingOptions = {
    monthly: {},
    maxWatchers: 10000,
    tmdbDetailsCache: cache.details,
    tmdbTranslationCache: cache.translations,
    tmdbProvidersCache: cache.providers,
    tmdbExternalIdsCache: cache.externalIds,
  };

  // Обробляємо шоу партіями
  const results = await processShowsBatch(taskData, processingOptions);

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
  return createTrendingShowsCache();
}

// ========== ФУНКЦІЇ КООРДИНАТОРА ==========

export { createSyncJob, updateJobStats } from './job';

// ========== УПРАВЛІННЯ КЕШАМИ ==========

export { createTrendingShowsCache, clearTrendingShowsCache, getCacheStats } from './caches';

// ========== РОБОТА З TRAKT API ==========

export { getTrendingShows, filterValidTraktShows, convertShowsToTaskData } from './shows';

// ========== ОБРОБКА ШОУ ==========

export { processShowsBatch, aggregateResults } from './processing';

// ========== УПРАВЛІННЯ ЗАДАЧАМИ ==========

export {
  getPendingTasks,
  updateTaskToProcessing,
  updateTaskToDone,
  updateTaskToError,
  createTasksBatch,
} from './tasks';
