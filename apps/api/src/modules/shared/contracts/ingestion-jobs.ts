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
  LINK_PENDING_IMPORTS = 'link-pending-imports',

  /** Dispatcher job: finds items without Rotten Tomatoes ratings and queues MDBList fetch. @queue ingestion */
  BACKFILL_MDBLIST_RATINGS_DISPATCHER = 'backfill-mdblist-ratings-dispatcher',
  /** Item job: fetches RT ratings (critics + audience) from MDBList. @queue ratings-backfill */
  BACKFILL_MDBLIST_RATINGS_ITEM = 'backfill-mdblist-ratings-item',
}

export interface SyncMediaJobData {
  tmdbId: number;
  userRequested?: boolean;
}
