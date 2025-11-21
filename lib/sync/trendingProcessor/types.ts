/**
 * Types and interfaces for trending processor module
 */

import type {
  TMDBShowDetails,
  TMDBShowTranslation,
  WatchProvider,
  TMDBExternalIds,
  TraktTrendingShow,
} from '@/lib/types';
import type { MonthlyMaps } from '@/lib/sync/monthly/types';
import type { LRUCache } from '@/lib/sync/utils';

/**
 * Configuration for trending processor
 */
export interface TrendingProcessorConfig {
  /** Maximum number of tasks to process */
  limit?: number;
  /** Concurrency level for parallel processing */
  concurrency?: number;
  /** Maximum watchers threshold */
  maxWatchers?: number;
  /** Keywords for anime detection */
  animeKeywords?: string[];
}

/**
 * Result of trending processor execution
 */
export interface TrendingProcessorResult {
  /** Whether processing completed successfully */
  success: boolean;
  /** Total number of tasks processed */
  processed: number;
  /** Number of successfully processed tasks */
  succeeded: number;
  /** Number of failed tasks */
  failed: number;
}

/**
 * Configuration for cache management
 */
export interface CacheConfig {
  /** TMDB details cache size */
  detailsSize: number;
  /** Translation cache size */
  translationSize: number;
  /** Providers cache size */
  providersSize: number;
  /** Content rating cache size */
  contentRatingSize: number;
  /** External IDs cache size */
  externalIdsSize: number;
}

/**
 * Complete cache container for trending processor operations
 */
export interface TrendingCache {
  /** TMDB show details cache */
  details: LRUCache<number, TMDBShowDetails>;
  /** TMDB show translations cache */
  translations: LRUCache<number, TMDBShowTranslation>;
  /** Watch providers cache */
  providers: LRUCache<string, WatchProvider[]>;
  /** Content ratings cache */
  contentRatings: LRUCache<string, string | null>;
  /** External IDs cache */
  externalIds: LRUCache<number, TMDBExternalIds>;
  /** Current trending TMDB IDs */
  currentTrending: Set<number>;
}

/**
 * Configuration for task processing
 */
export interface TaskProcessorConfig {
  /** Monthly viewing maps */
  monthly: MonthlyMaps;
  /** Cache container */
  cache: TrendingCache;
  /** Maximum watchers threshold */
  maxWatchers?: number;
  /** Keywords for anime detection */
  animeKeywords?: string[];
  /** Retry callback function */
  onRetryLabel?: (label: string) => (attempt: number, err: any) => void;
}

/**
 * Result of task processing
 */
export interface TaskProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Error message if processing failed */
  error?: string;
  /** Processed show data */
  data?: any;
}

/**
 * Task data structure from database
 */
export interface TaskData {
  /** Task ID */
  id: number;
  /** Job ID */
  jobId: number;
  /** TMDB ID */
  tmdbId: number;
  /** Task payload */
  payload: any;
  /** Number of processing attempts */
  attempts?: number;
}

/**
 * Configuration for task fetching
 */
export interface FetchTasksConfig {
  /** Maximum number of tasks to fetch */
  limit: number;
  /** Status filter (default: 'pending') */
  status?: TaskStatus;
}

/**
 * Result of task status update
 */
export interface UpdateResult {
  /** Whether update was successful */
  success: boolean;
  /** Number of affected rows */
  affectedRows: number;
}

/**
 * Task status values
 */
export type TaskStatus = 'pending' | 'processing' | 'done' | 'error';
