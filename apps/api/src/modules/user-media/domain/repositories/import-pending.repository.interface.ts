import {
  type ImportPendingFailure,
  type ImportPendingItemStatus,
} from '../constants/import-pending.constants';
import { type ImportBatch } from '../entities/import-batch';
import { type ImportPendingItem } from '../entities/import-pending-item';

export interface CreateBatchInput {
  userId: string;
  source: string;
  totalItems: number;
}

export interface CreatePendingItemInput {
  batchId: string;
  imdbId?: string | null;
  tmdbId?: number | null;
  title?: string | null;
  rating?: number | null;
  state: 'completed' | 'planned';
}

export interface UpdatePendingItemInput {
  status: ImportPendingItemStatus;
  resolvedTmdbId?: number | null;
  mediaType?: 'movie' | 'show' | null;
  failureReason?: ImportPendingFailure | null;
  mediaItemId?: string | null;
}

export interface IImportPendingRepository {
  /** Creates a new import batch record. */
  createBatch(input: CreateBatchInput): Promise<ImportBatch>;

  /** Bulk-inserts pending items for a batch. */
  createPendingItems(items: CreatePendingItemInput[]): Promise<void>;

  /**
   * Atomically creates a batch and its pending items in a single transaction.
   * Prevents partial state where a batch exists without items (or vice versa).
   */
  createBatchWithItems(
    batch: CreateBatchInput,
    items: Omit<CreatePendingItemInput, 'batchId'>[],
  ): Promise<ImportBatch>;

  /** Finds a single batch by ID. Returns null if not found. */
  findBatchById(batchId: string): Promise<ImportBatch | null>;

  /** Finds the most recent batches for a user, ordered by creation date desc. */
  findActiveBatchesByUser(userId: string, limit?: number): Promise<ImportBatch[]>;

  /** Finds all pending items in a batch with the given status. */
  findPendingByBatchAndStatus(
    batchId: string,
    status: ImportPendingItemStatus,
  ): Promise<ImportPendingItem[]>;

  /** Finds a single pending item by ID. Returns null if not found. */
  findById(itemId: string): Promise<ImportPendingItem | null>;

  /**
   * Finds pending items waiting to be linked for a specific resolved TMDB ID and media type.
   * Used by LinkImportListener after media.synced event fires.
   */
  findItemsByResolvedTmdb(
    resolvedTmdbId: number,
    mediaType: string,
    status: ImportPendingItemStatus,
  ): Promise<ImportPendingItem[]>;

  /** Updates the status and optional fields of a single pending item. */
  updateItemStatus(itemId: string, update: UpdatePendingItemInput): Promise<void>;

  /**
   * Updates a pending item's status only if it has not been cancelled.
   * Returns true if the update was applied, false if the item was already cancelled.
   */
  updateItemStatusIfNotCancelled(itemId: string, update: UpdatePendingItemInput): Promise<boolean>;

  /**
   * Cancels all non-terminal items in a batch and marks the batch as cancelled.
   * Items already in DONE or FAILED state are left unchanged.
   */
  cancelBatch(batchId: string): Promise<void>;

  /**
   * Atomic batch counter update.
   *
   * Executes a single UPDATE statement with subqueries to:
   * 1. Recount done/failed items from import_pending_items
   * 2. Transition batch status to 'completed' when no items remain in non-terminal states
   *
   * This avoids TOCTOU race conditions when multiple items complete concurrently.
   */
  updateBatchCountersAtomic(batchId: string): Promise<ImportBatch | null>;
}
