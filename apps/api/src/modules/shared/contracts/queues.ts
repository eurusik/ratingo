/**
 * Queue name for ingestion tasks (Trakt/OMDb/TVMaze — rate-limited).
 */
export const INGESTION_QUEUE = 'ingestion';

/**
 * Queue name for backfill tasks (TMDB-only — high throughput).
 * Separated from ingestion queue to avoid Trakt rate limiter bottleneck.
 */
export const BACKFILL_QUEUE = 'backfill';

/**
 * Queue name for external ratings backfill (MDBList and similar
 * low-quota providers — strict rate limiting, long-running drain).
 *
 * Separated from BACKFILL_QUEUE because MDBList free tier is capped at
 * 1000 requests/day; cannot share the TMDB-tuned 600/min limiter.
 */
export const RATINGS_BACKFILL_QUEUE = 'ratings-backfill';

/**
 * Shared default job options for both ingestion and backfill queues.
 * Backfill queue overrides `removeOnComplete` for higher observability.
 */
export const DEFAULT_INGESTION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
} as const;
