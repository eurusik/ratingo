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
}
