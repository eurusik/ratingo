/**
 * Trending processor modules - re-exports for convenient access.
 *
 * @module trending
 * @example
 * import { runTrendingProcessor } from '@/lib/sync/trending';
 * import { createTrendingCache } from '@/lib/sync/trending';
 * import { fetchPendingTasks } from '@/lib/sync/trending';
 */

// Main processor
export { runTrendingProcessor, DEFAULT_CONFIG } from '@/lib/sync/trendingProcessor/processor';

export type {
  TrendingProcessorConfig,
  TrendingProcessorResult,
} from '@/lib/sync/trendingProcessor/types';

// Cache management
export {
  createTrendingCache,
  clearTrendingCache,
  getCacheStats,
  DEFAULT_CACHE_CONFIG,
} from '@/lib/sync/trendingProcessor/caches';

export type { TrendingCache, CacheConfig } from '@/lib/sync/trendingProcessor/types';

// Task processing
export {
  processTrendingTask,
  transformToTraktItem,
  calculateMaxWatchers,
  createRetryLabelHandler,
} from '@/lib/sync/trendingProcessor/tasks';

export type { TaskProcessorConfig, TaskProcessingResult } from '@/lib/sync/trendingProcessor/types';

// Database operations
export {
  fetchPendingTasks,
  updateTaskStatus,
  bulkUpdateTaskStatus,
  getTaskStats,
} from '@/lib/sync/trendingProcessor/database';

export type {
  TaskData,
  FetchTasksConfig,
  UpdateResult,
  TaskStatus,
} from '@/lib/sync/trendingProcessor/types';

// Performance monitoring
export {
  measurePerformance,
  createPerformanceMetrics,
  formatPerformanceMetrics,
} from '@/lib/sync/trendingProcessor/performance';

export type {
  PerformanceResult,
  PerformanceMetrics,
} from '@/lib/sync/trendingProcessor/performance';
