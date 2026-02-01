/**
 * Queue name for stats-related background jobs.
 */
export const STATS_QUEUE = 'stats-queue';

/**
 * Job types for the stats queue.
 */
export const STATS_JOBS = {
  SYNC_TRENDING: 'sync-trending',
  SYNC_ELIGIBLE_TRENDING: 'sync-eligible-trending',
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

/**
 * Homepage candidates refresh configuration.
 * Targets items that may appear in Hero or Watching-Now sections.
 * Uses the lower quality threshold (50) to cover both:
 * - Hero requires qualityScore ≥ 60
 * - Watching-Now requires qualityScore ≥ 50
 */
export const HOMEPAGE_REFRESH_CONFIG = {
  /** Hours since last update to consider stats stale */
  STALE_THRESHOLD_HOURS: 24,
  /** Max items to refresh per run */
  BATCH_SIZE: 30,
  /** Minimum quality score (covers both hero@60 and watching-now@50) */
  MIN_QUALITY_SCORE: 50,
} as const;

/**
 * @deprecated Use HOMEPAGE_REFRESH_CONFIG instead
 */
export const HERO_REFRESH_CONFIG = HOMEPAGE_REFRESH_CONFIG;
