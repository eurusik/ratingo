/**
 * Queue name for stats-related background jobs.
 */
export const STATS_QUEUE = 'stats-queue';

/**
 * Job types for the stats queue.
 */
export const STATS_JOBS = {
  SYNC_TRENDING: 'sync-trending',
  ANALYZE_DROP_OFF: 'analyze-drop-off',
  BACKFILL_WATCHERS_CHUNK: 'backfill-watchers-chunk',
} as const;

/**
 * Backfill configuration.
 */
export const BACKFILL_CONFIG = {
  /** Number of items per chunk */
  CHUNK_SIZE: 20,
  /** Delay between chunks in ms */
  CHUNK_DELAY_MS: 5000,
  /** Max retry attempts per chunk */
  MAX_RETRIES: 5,
  /** Base backoff delay in ms (exponential: 10s, 20s, 40s, 80s, 160s) */
  BACKOFF_BASE_MS: 10000,
} as const;
