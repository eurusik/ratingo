/**
 * Ingestion Status Constants
 *
 * Defines status values for media item ingestion process.
 */

/**
 * Ingestion status values (stored in DB).
 */
export const IngestionStatus = {
  READY: 'ready',
  PENDING: 'pending',
  FAILED: 'failed',
  PROCESSING: 'processing',
} as const;

export type IngestionStatusType = (typeof IngestionStatus)[keyof typeof IngestionStatus];
