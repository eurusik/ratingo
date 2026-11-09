import type * as schema from '@/database/schema';
import {
  type ImportBatchStatus,
  type ImportPendingItemStatus,
} from '@/modules/user-media/domain/constants/import-pending.constants';
import { type ImportBatch } from '@/modules/user-media/domain/entities/import-batch';
import { type ImportPendingItem } from '@/modules/user-media/domain/entities/import-pending-item';
import { type UpdatePendingItemInput } from '@/modules/user-media/domain/repositories/import-pending.repository.interface';

export function toPendingItemUpdateValues(update: UpdatePendingItemInput): Record<string, unknown> {
  const setValues: Record<string, unknown> = {
    status: update.status,
    updatedAt: new Date(),
  };

  if (update.resolvedTmdbId !== undefined) setValues.resolvedTmdbId = update.resolvedTmdbId;
  if (update.mediaType !== undefined) setValues.mediaType = update.mediaType;
  if (update.failureReason !== undefined) setValues.failureReason = update.failureReason;
  if (update.mediaItemId !== undefined) setValues.mediaItemId = update.mediaItemId;

  return setValues;
}

export function toImportBatch(row: typeof schema.importBatches.$inferSelect): ImportBatch {
  return {
    id: row.id,
    userId: row.userId,
    source: row.source,
    totalItems: row.totalItems,
    completedCount: row.completedCount,
    failedCount: row.failedCount,
    status: row.status as ImportBatchStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toImportPendingItem(
  row: typeof schema.importPendingItems.$inferSelect,
): ImportPendingItem {
  return {
    id: row.id,
    batchId: row.batchId,
    imdbId: row.imdbId,
    tmdbId: row.tmdbId,
    resolvedTmdbId: row.resolvedTmdbId,
    mediaType: row.mediaType as 'movie' | 'show' | null,
    title: row.title,
    rating: row.rating,
    state: row.state as 'completed' | 'planned',
    status: row.status as ImportPendingItemStatus,
    failureReason: row.failureReason as ImportPendingItem['failureReason'],
    mediaItemId: row.mediaItemId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
