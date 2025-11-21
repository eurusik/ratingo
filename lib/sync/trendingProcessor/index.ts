/**
 * Головний модуль процесора трендів
 * Надає централізований доступ до всіх функцій та типів процесора трендів
 *
 * @module trendingProcessor
 * @example
 * // Імпорт основних функцій
 * import { runTrendingProcessor } from '@/lib/sync/trendingProcessor';
 *
 * // Імпорт типів
 * import type { TrendingProcessorConfig, TrendingProcessorResult } from '@/lib/sync/trendingProcessor';
 *
 * // Використання
 * const result = await runTrendingProcessor({ limit: 20, concurrency: 8 });
 */

// Головний процесор
export { runTrendingProcessor, DEFAULT_CONFIG } from './processor';
export type { TrendingProcessorConfig, TrendingProcessorResult } from './types';

// Кешування
export {
  createTrendingCache,
  clearTrendingCache,
  getCacheStats,
  DEFAULT_CACHE_CONFIG,
} from './caches';
export type { TrendingCache, CacheConfig } from './types';

// Обробка завдань
export {
  processTrendingTask,
  transformToTraktItem,
  calculateMaxWatchers,
  createRetryLabelHandler,
} from './tasks';
export type { TaskProcessorConfig, TaskProcessingResult } from './types';

// Операції бази даних
export {
  fetchPendingTasks,
  updateTaskStatus,
  bulkUpdateTaskStatus,
  getTaskStats,
} from './database';
export type { TaskData, FetchTasksConfig, UpdateResult, TaskStatus } from './types';

// Продуктивність
export {
  measurePerformance,
  createPerformanceMetrics,
  formatPerformanceMetrics,
} from './performance';
export type { PerformanceResult, PerformanceMetrics } from './performance';
