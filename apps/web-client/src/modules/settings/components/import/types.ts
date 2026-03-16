/**
 * Shared types and constants for the import wizard components.
 */

export interface FileState {
  status: 'idle' | 'loaded' | 'error';
  fileName?: string;
  itemCount?: number;
  skippedCount?: number;
  errorMessage?: string;
}

/** Batch processing status constants — mirrors backend IMPORT_BATCH_STATUS. */
export const BATCH_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type BatchStatus = (typeof BATCH_STATUS)[keyof typeof BATCH_STATUS];
