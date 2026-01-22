import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Result of aggregating watchers fetch results for logging.
 */
export interface WatchersAggregationResult {
  /** Number of items successfully fetched */
  fetched: number;
  /** Number of items skipped due to transient errors */
  skipped: number;
  /** Number of items not found in Trakt */
  notFound: number;
  /** Examples of not-found items for debugging */
  notFoundExamples: { tmdbId: number; type: string }[];
}

/**
 * Options for trending stats sync operations.
 */
export interface TrendingSyncOptions {
  /** Only sync items updated after this date */
  since?: Date;
  /** Max items to sync */
  limit: number;
}

/**
 * Options for score recalculation.
 */
export interface RecalculateScoresOptions {
  /** Filter by media type (movie/show) */
  type?: MediaType;
  /** Number of items per batch */
  batchSize?: number;
}

/**
 * Options for total watchers backfill.
 */
export interface BackfillTotalWatchersOptions {
  /** Filter by media type (movie/show) */
  type?: MediaType;
  /** Max items to process */
  limit?: number;
  /** Minimum Trakt votes to consider */
  minVotes?: number;
}

/**
 * Options for watchers count backfill queue.
 */
export interface QueueWatchersCountBackfillOptions {
  /** Filter by media type (movie/show) */
  type?: MediaType;
  /** Max items to process */
  limit?: number;
  /** Minimum total_watchers to consider */
  minTotalWatchers?: number;
}
