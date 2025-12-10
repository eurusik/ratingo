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
  SYNC_TRENDING_FULL = 'sync-trending-full',
  UPDATE_NOW_PLAYING_FLAGS = 'update-now-playing-flags',
  SYNC_SNAPSHOTS = 'sync-snapshots',
}
