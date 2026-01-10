/**
 * Queue name for ingestion tasks.
 */
export const INGESTION_QUEUE = 'ingestion';

/**
 * Job names for ingestion queue.
 * Used by Producer (Controller) and Consumer (Worker).
 */
export enum IngestionJob {
  SYNC_MOVIE = 'sync-movie',
  SYNC_SHOW = 'sync-show',
  SYNC_NOW_PLAYING = 'sync-now-playing',
  SYNC_NEW_RELEASES = 'sync-new-releases',
  UPDATE_NOW_PLAYING_FLAGS = 'update-now-playing-flags',
  SYNC_SNAPSHOTS = 'sync-snapshots',

  /** Dispatcher job: iterates over all media and queues item jobs */
  SYNC_SNAPSHOTS_DISPATCHER = 'sync-snapshots-dispatcher',
  /** Item job: syncs watchers snapshot for a single media item */
  SYNC_SNAPSHOT_ITEM = 'sync-snapshot-item',

  /** Dispatcher job: fetches tracked show IDs and queues batch jobs */
  SYNC_TRACKED_SHOWS = 'sync-tracked-shows',
  /** Batch job: syncs a chunk of tracked shows with diff detection */
  SYNC_TRACKED_SHOW_BATCH = 'sync-tracked-show-batch',

  /** Dispatcher job: queues page jobs for trending movies and shows */
  SYNC_TRENDING_DISPATCHER = 'sync-trending-dispatcher',
  /** Page job: syncs one page of trending items */
  SYNC_TRENDING_PAGE = 'sync-trending-page',
  /** Stats job: syncs Trakt stats after all trending pages complete */
  SYNC_TRENDING_STATS = 'sync-trending-stats',

  /** @deprecated Use SYNC_TRENDING_DISPATCHER instead */
  SYNC_TRENDING_FULL = 'sync-trending-full',

  /** Dispatcher job: finds shows without IMDb ID and queues re-sync */
  BACKFILL_IMDB_DISPATCHER = 'backfill-imdb-dispatcher',
  /** Item job: re-syncs a single show to fetch IMDb ID */
  BACKFILL_IMDB_ITEM = 'backfill-imdb-item',
}

/**
 * Chunk size for tracked shows batch processing.
 */
export const TRACKED_SHOWS_CHUNK_SIZE = 50;

/**
 * Delay between TMDB API calls in milliseconds.
 * TMDB rate limit: ~40 requests per 10 seconds.
 * 300ms delay = ~3.3 req/s = safe margin.
 */
export const TMDB_REQUEST_DELAY_MS = 300;

/**
 * Batch size for snapshot dispatcher pagination.
 */
export const SNAPSHOTS_BATCH_SIZE = 500;

/**
 * Bulk limit for tracked shows job enqueueing.
 */
export const TRACKED_SHOWS_BULK_LIMIT = 10;

/**
 * Delay before trending stats sync job (in milliseconds).
 * Allows time for page jobs to complete before stats aggregation.
 * 3 minutes = 180000ms
 */
export const TRENDING_STATS_DELAY_MS = 180000;

/**
 * Default number of pages to sync for trending.
 * 10 pages × 20 items = 200 items before Policy Engine filtering.
 * Expected ~100 eligible items after filtering (~50% pass rate).
 */
export const TRENDING_DEFAULT_PAGES = 10;

/**
 * Default limit for trending stats sync.
 */
export const TRENDING_DEFAULT_STATS_LIMIT = 200;

/**
 * Items per page in TMDB trending API.
 */
export const TMDB_TRENDING_PAGE_SIZE = 20;

/**
 * Default concurrency for Trakt API batch requests.
 */
export const TRAKT_BATCH_CONCURRENCY = 3;

/**
 * Concurrency for job deduplication checks in Redis.
 */
export const JOB_DEDUPE_CHECK_CONCURRENCY = 50;

/**
 * Max seasons to fetch for drop-off analysis.
 */
export const MAX_SEASONS_FOR_ANALYSIS = 10;
