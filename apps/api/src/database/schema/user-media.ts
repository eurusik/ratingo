import { pgTable, text, integer, timestamp, index, pgEnum, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

// ============================================================
// IMPORT BATCHES & PENDING ITEMS
// ============================================================

export const importBatchStatusEnum = pgEnum('import_batch_status', [
  'processing',
  'completed',
  'cancelled',
]);

export const importPendingStatusEnum = pgEnum('import_pending_status', [
  'pending',
  'resolving',
  'ingesting',
  'linking',
  'done',
  'failed',
  'cancelled',
]);

/**
 * Tracks a batch of not-found import items submitted for background auto-ingestion.
 * Created when a CSV import contains items not present in the Ratingo catalog.
 */
export const importBatches = pgTable(
  'import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Import source identifier (e.g. 'kinobaza'). */
    source: text('source').notNull(),
    totalItems: integer('total_items').notNull(),
    completedCount: integer('completed_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    status: importBatchStatusEnum('status').notNull().default('processing'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Supports findActiveBatchesByUser: WHERE userId = ? AND status = ? ORDER BY createdAt DESC
    userStatusCreatedAtIdx: index('import_batches_user_status_created_at_idx').on(
      t.userId,
      t.status,
      t.createdAt,
    ),
  }),
);

/**
 * Individual items within an import batch awaiting TMDB resolution and catalog ingestion.
 * Each item tracks its own lifecycle from pending → resolving → ingesting → done/failed.
 */
export const importPendingItems = pgTable(
  'import_pending_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => importBatches.id, { onDelete: 'cascade' }),
    imdbId: text('imdb_id'),
    tmdbId: integer('tmdb_id'),
    resolvedTmdbId: integer('resolved_tmdb_id'),
    mediaType: text('media_type'),
    title: text('title'),
    /** Rating on internal 1-100 scale. */
    rating: integer('rating'),
    /** User's intended watch state from the import source ('completed' | 'planned'). */
    state: text('state').notNull(),
    status: importPendingStatusEnum('status').notNull().default('pending'),
    failureReason: text('failure_reason'),
    /** Catalog media_item UUID once the item has been ingested and linked. */
    mediaItemId: uuid('media_item_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_pending_batch_status').on(t.batchId, t.status),
    index('idx_pending_resolved_tmdb').on(t.resolvedTmdbId, t.mediaType, t.status),
  ],
);
