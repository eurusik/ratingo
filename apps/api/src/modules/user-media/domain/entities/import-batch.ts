import { type ImportBatchStatus } from '../constants/import-pending.constants';

/**
 * Aggregate root representing a batch of pending import items.
 *
 * Created when a CSV import contains items not found in the catalog.
 * Tracks overall progress as individual items are resolved and ingested.
 *
 * Pure domain interface — zero NestJS/Drizzle dependencies.
 */
export interface ImportBatch {
  id: string;
  userId: string;
  /** Import source identifier (e.g. 'kinobaza'). */
  source: string;
  totalItems: number;
  completedCount: number;
  failedCount: number;
  status: ImportBatchStatus;
  createdAt: Date;
  updatedAt: Date;
}
