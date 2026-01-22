/**
 * Queue Worker Configuration
 *
 * Centralized lock settings for BullMQ workers.
 * lockDuration must exceed the longest expected job duration to prevent
 * "Missing lock" errors and job double-processing.
 *
 * BullMQ auto-calculates lockRenewTime as lockDuration/2.
 */

/**
 * Worker lock configuration interface.
 */
export interface WorkerLockConfig {
  /** Lock duration in milliseconds. Must exceed longest expected job duration. */
  lockDuration: number;
}

/**
 * Worker rate limiter configuration interface (BullMQ limiter).
 * Uses Redis to control job throughput across all workers.
 */
export interface WorkerLimiterConfig {
  /** Maximum number of jobs to process within the duration window. */
  max: number;
  /** Duration window in milliseconds. */
  duration: number;
}

/**
 * Queue-specific worker configurations.
 *
 * Values are based on analysis of job characteristics:
 * - ingestion: HTTP calls to TMDB, Trakt, OMDb, TVMaze with concurrency=5
 * - catalogPolicy: Policy evaluation + batch dispatch, concurrency=1
 * - stats: Drop-off analysis with Trakt rate limiting, concurrency=1
 */
export const WORKER_CONFIG = {
  /**
   * Ingestion queue worker config.
   * Jobs: sync-movie, sync-show, sync-trending-*, sync-snapshots, etc.
   * Duration: 1-60+ seconds (HTTP calls to 4+ external APIs)
   *
   * Rate limiter: 30 jobs/min to prevent Trakt API 429 errors.
   * Math: Trakt limit ~3 req/s = 180/min. Each job makes ~4 calls.
   * Safe jobs/min: 180 ÷ 4 = 45, with safety margin → 30.
   */
  ingestion: {
    lockDuration: 120_000, // 2 minutes
    limiter: {
      max: 30, // 30 jobs per minute
      duration: 60_000, // 1 minute window
    },
  },

  /**
   * Catalog policy queue worker config.
   * Jobs: re-evaluate-all, evaluate-catalog-item, watchdog
   * Duration: 100ms-30s (policy evaluation + DB writes)
   */
  catalogPolicy: {
    lockDuration: 60_000, // 1 minute
  },

  /**
   * Stats queue worker config.
   * Jobs: sync-trending, analyze-drop-off, backfill-watchers-chunk
   * Duration: 2-180+ seconds (I/O bound with Trakt rate limits)
   */
  stats: {
    lockDuration: 180_000, // 3 minutes
  },
} as const satisfies Record<string, WorkerLockConfig & { limiter?: WorkerLimiterConfig }>;
