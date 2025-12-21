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
