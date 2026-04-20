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
  /** @deprecated Use batch processing in SnapshotsPipeline.dispatch() */
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
  /** Item job: fetches external IDs from TMDB for a single show. @queue backfill */
  BACKFILL_IMDB_ITEM = 'backfill-imdb-item',

  /** Dispatcher job: finds items without alternative titles and queues TMDB fetch */
  BACKFILL_ALT_TITLES_DISPATCHER = 'backfill-alt-titles-dispatcher',
  /** Item job: fetches alternative titles from TMDB for a single item. @queue backfill */
  BACKFILL_ALT_TITLES_ITEM = 'backfill-alt-titles-item',

  /** Dispatcher job: loads pending import items for a batch and queues per-item jobs. @queue backfill */
  RESOLVE_IMPORT_DISPATCHER = 'resolve-import-dispatcher',
  /** Item job: resolves a single pending import item via TMDB Find API, queues SYNC_MOVIE/SYNC_SHOW. @queue backfill */
  RESOLVE_IMPORT_ITEM = 'resolve-import-item',

  /** Dispatcher job: finds items without Rotten Tomatoes ratings and queues MDBList fetch. @queue ingestion */
  BACKFILL_MDBLIST_RATINGS_DISPATCHER = 'backfill-mdblist-ratings-dispatcher',
  /** Item job: fetches RT ratings (critics + audience) from MDBList. @queue ratings-backfill */
  BACKFILL_MDBLIST_RATINGS_ITEM = 'backfill-mdblist-ratings-item',
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
 * Reduced from 200 to 50 to avoid Trakt rate limiting.
 * Each item requires ~4 API calls, so 50 items = ~200 calls.
 */
export const TRENDING_DEFAULT_STATS_LIMIT = 50;

/**
 * Maximum batches for eligible trending backfill per pipeline run.
 * Limits API calls to avoid rate limiting during scheduled sync.
 * 2 batches × 50 items = 100 items max; HTTP calls bounded by chunking
 * (e.g., ceil(50/10) = 5 calls per media type per batch).
 * Remaining items will be processed in next scheduled run.
 */
export const ELIGIBLE_BACKFILL_MAX_BATCHES = 2;

/**
 * Items per page in TMDB trending API.
 */
export const TMDB_TRENDING_PAGE_SIZE = 20;

/**
 * Default concurrency for Trakt API batch requests.
 * Set to 1 to avoid rate limiting (Trakt allows ~10 req/s but we share the limit).
 * With 2 API calls per item (search + watching), concurrency=1 means ~2 req/s.
 */
export const TRAKT_BATCH_CONCURRENCY = 1;

/**
 * Chunk size for bulk Trakt operations.
 * Process this many items, then pause before next chunk.
 */
export const TRAKT_BULK_CHUNK_SIZE = 10;

/**
 * Delay between chunks in bulk Trakt operations (ms).
 * Helps avoid hitting rate limits.
 */
export const TRAKT_BULK_CHUNK_DELAY_MS = 2000;

/**
 * Concurrency for job deduplication checks in Redis.
 */
export const JOB_DEDUPE_CHECK_CONCURRENCY = 50;

/**
 * Max seasons to fetch for drop-off analysis.
 */
export const MAX_SEASONS_FOR_ANALYSIS = 10;

/**
 * Batch size for alternative titles backfill dispatcher pagination.
 */
export const BACKFILL_ALT_TITLES_BATCH_SIZE = 100;

/**
 * Batch size for MDBList ratings backfill dispatcher pagination.
 * Kept small because the MDBList free-tier budget is 1000 req/day —
 * dispatcher runs once per day, so queueing the whole day's quota at
 * once is enough. Worker limiter enforces the per-hour pace.
 */
export const BACKFILL_MDBLIST_RATINGS_BATCH_SIZE = 100;

/**
 * Minimum days to wait before re-checking a media item whose MDBList
 * ratings fetch was already attempted. Without this, items for which
 * MDBList has no RT data would be re-polled on every dispatcher run
 * and silently burn the daily quota.
 *
 * 90 days is long enough that MDBList genuinely may have received new
 * data for the title (e.g. newly reviewed indie film), short enough
 * that users see updates within a season.
 */
export const MDBLIST_RATINGS_REFRESH_DAYS = 90;
