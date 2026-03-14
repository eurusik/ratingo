export const IMPORT_BATCH_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
} as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUS)[keyof typeof IMPORT_BATCH_STATUS];

export const IMPORT_PENDING_STATUS = {
  PENDING: 'pending',
  RESOLVING: 'resolving',
  INGESTING: 'ingesting',
  LINKING: 'linking',
  DONE: 'done',
  FAILED: 'failed',
} as const;
export type ImportPendingItemStatus =
  (typeof IMPORT_PENDING_STATUS)[keyof typeof IMPORT_PENDING_STATUS];

export const IMPORT_PENDING_FAILURE = {
  TMDB_NOT_FOUND: 'tmdb_not_found',
  INGEST_FAILED: 'ingest_failed',
  LINK_FAILED: 'link_failed',
} as const;
export type ImportPendingFailure =
  (typeof IMPORT_PENDING_FAILURE)[keyof typeof IMPORT_PENDING_FAILURE];

export const MAX_PENDING_ITEMS_PER_BATCH = 500;

/** Maximum number of recent batches returned by getUserBatches(). */
export const USER_BATCHES_LIMIT = 10;

export const IMPORT_PENDING_REPOSITORY = Symbol('IMPORT_PENDING_REPOSITORY');
