/**
 * Queue name for stats-related background jobs.
 */
export const STATS_QUEUE = 'stats-queue';

/**
 * Job types for the stats queue.
 */
export const STATS_JOBS = {
  SYNC_TRENDING: 'sync-trending',
} as const;
