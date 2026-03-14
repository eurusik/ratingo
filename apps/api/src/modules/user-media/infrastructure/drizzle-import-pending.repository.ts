import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  IMPORT_BATCH_STATUS,
  IMPORT_PENDING_STATUS,
  type ImportBatchStatus,
  type ImportPendingItemStatus,
} from '../domain/constants/import-pending.constants';
import { type ImportBatch } from '../domain/entities/import-batch';
import { type ImportPendingItem } from '../domain/entities/import-pending-item';
import {
  type CreateBatchInput,
  type CreatePendingItemInput,
  type IImportPendingRepository,
  type UpdatePendingItemInput,
} from '../domain/repositories/import-pending.repository.interface';

type CreatePendingItemWithoutBatchId = Omit<CreatePendingItemInput, 'batchId'>;

@Injectable()
export class DrizzleImportPendingRepository implements IImportPendingRepository {
  private static readonly BATCH_INSERT_SIZE = 500;

  private readonly logger = new Logger(DrizzleImportPendingRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createBatch(input: CreateBatchInput): Promise<ImportBatch> {
    return withDbError(
      'create import batch',
      this.logger,
      async () => {
        const [row] = await this.db
          .insert(schema.importBatches)
          .values({
            userId: input.userId,
            source: input.source,
            totalItems: input.totalItems,
          })
          .returning();
        return this.mapBatch(row);
      },
      { userId: input.userId, source: input.source },
    );
  }

  async createPendingItems(items: CreatePendingItemInput[]): Promise<void> {
    if (items.length === 0) return;

    return withDbError(
      'create pending import items',
      this.logger,
      async () => {
        for (let i = 0; i < items.length; i += DrizzleImportPendingRepository.BATCH_INSERT_SIZE) {
          const chunk = items.slice(i, i + DrizzleImportPendingRepository.BATCH_INSERT_SIZE);
          await this.db.insert(schema.importPendingItems).values(
            chunk.map((item) => ({
              batchId: item.batchId,
              imdbId: item.imdbId ?? null,
              tmdbId: item.tmdbId ?? null,
              title: item.title ?? null,
              rating: item.rating ?? null,
              state: item.state,
            })),
          );
        }
      },
      { itemCount: items.length },
    );
  }

  async createBatchWithItems(
    batchInput: CreateBatchInput,
    items: CreatePendingItemWithoutBatchId[],
  ): Promise<ImportBatch> {
    return withDbError(
      'create batch with items',
      this.logger,
      async () => {
        return this.db.transaction(async (tx) => {
          const [batchRow] = await tx
            .insert(schema.importBatches)
            .values({
              userId: batchInput.userId,
              source: batchInput.source,
              totalItems: batchInput.totalItems,
            })
            .returning();

          if (items.length > 0) {
            for (
              let i = 0;
              i < items.length;
              i += DrizzleImportPendingRepository.BATCH_INSERT_SIZE
            ) {
              const chunk = items.slice(i, i + DrizzleImportPendingRepository.BATCH_INSERT_SIZE);
              await tx.insert(schema.importPendingItems).values(
                chunk.map((item) => ({
                  batchId: batchRow.id,
                  imdbId: item.imdbId ?? null,
                  tmdbId: item.tmdbId ?? null,
                  title: item.title ?? null,
                  rating: item.rating ?? null,
                  state: item.state,
                })),
              );
            }
          }

          return this.mapBatch(batchRow);
        });
      },
      { userId: batchInput.userId, source: batchInput.source, itemCount: items.length },
    );
  }

  async findBatchById(batchId: string): Promise<ImportBatch | null> {
    return withDbError(
      'find import batch by id',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.importBatches)
          .where(eq(schema.importBatches.id, batchId))
          .limit(1);
        return row ? this.mapBatch(row) : null;
      },
      { batchId },
    );
  }

  async findActiveBatchesByUser(userId: string, limit = 10): Promise<ImportBatch[]> {
    return withDbError(
      'find active import batches by user',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.importBatches)
          .where(eq(schema.importBatches.userId, userId))
          .orderBy(desc(schema.importBatches.createdAt))
          .limit(limit);
        return rows.map((r) => this.mapBatch(r));
      },
      { userId },
    );
  }

  async findPendingByBatchAndStatus(
    batchId: string,
    status: ImportPendingItemStatus,
  ): Promise<ImportPendingItem[]> {
    return withDbError(
      'find pending items by batch and status',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.importPendingItems)
          .where(
            and(
              eq(schema.importPendingItems.batchId, batchId),
              eq(schema.importPendingItems.status, status),
            ),
          );
        return rows.map((r) => this.mapItem(r));
      },
      { batchId, status },
    );
  }

  async findById(itemId: string): Promise<ImportPendingItem | null> {
    return withDbError(
      'find pending item by id',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.importPendingItems)
          .where(eq(schema.importPendingItems.id, itemId))
          .limit(1);
        return row ? this.mapItem(row) : null;
      },
      { itemId },
    );
  }

  async findItemsByResolvedTmdb(
    resolvedTmdbId: number,
    mediaType: string,
    status: ImportPendingItemStatus,
  ): Promise<ImportPendingItem[]> {
    return withDbError(
      'find pending items by resolved tmdb',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.importPendingItems)
          .where(
            and(
              eq(schema.importPendingItems.resolvedTmdbId, resolvedTmdbId),
              eq(schema.importPendingItems.mediaType, mediaType),
              eq(schema.importPendingItems.status, status),
            ),
          );
        return rows.map((r) => this.mapItem(r));
      },
      { resolvedTmdbId, mediaType, status },
    );
  }

  async updateItemStatus(itemId: string, update: UpdatePendingItemInput): Promise<void> {
    return withDbError(
      'update pending item status',
      this.logger,
      async () => {
        const setValues: Record<string, unknown> = {
          status: update.status,
          updatedAt: new Date(),
        };

        if (update.resolvedTmdbId !== undefined) setValues.resolvedTmdbId = update.resolvedTmdbId;
        if (update.mediaType !== undefined) setValues.mediaType = update.mediaType;
        if (update.failureReason !== undefined) setValues.failureReason = update.failureReason;
        if (update.mediaItemId !== undefined) setValues.mediaItemId = update.mediaItemId;

        await this.db
          .update(schema.importPendingItems)
          .set(setValues)
          .where(eq(schema.importPendingItems.id, itemId));
      },
      { itemId, status: update.status },
    );
  }

  /**
   * Atomic batch counter update.
   *
   * Single UPDATE statement with correlated subqueries recounts done/failed items
   * and transitions batch status to 'completed' when no items remain pending.
   * Prevents TOCTOU race conditions when multiple items complete concurrently.
   */
  async updateBatchCountersAtomic(batchId: string): Promise<ImportBatch | null> {
    return withDbError(
      'update batch counters atomic',
      this.logger,
      async () => {
        const [row] = await this.db
          .update(schema.importBatches)
          .set({
            completedCount: sql<number>`(
              SELECT COUNT(*) FROM ${schema.importPendingItems}
              WHERE batch_id = ${batchId} AND status = ${IMPORT_PENDING_STATUS.DONE}
            )`,
            failedCount: sql<number>`(
              SELECT COUNT(*) FROM ${schema.importPendingItems}
              WHERE batch_id = ${batchId} AND status = ${IMPORT_PENDING_STATUS.FAILED}
            )`,
            status: sql<ImportBatchStatus>`CASE
              WHEN (
                SELECT COUNT(*) FROM ${schema.importPendingItems}
                WHERE batch_id = ${batchId}
                  AND status NOT IN (${IMPORT_PENDING_STATUS.DONE}, ${IMPORT_PENDING_STATUS.FAILED})
              ) = 0 THEN ${IMPORT_BATCH_STATUS.COMPLETED}::import_batch_status
              ELSE ${IMPORT_BATCH_STATUS.PROCESSING}::import_batch_status
            END`,
            updatedAt: sql`now()`,
          })
          .where(eq(schema.importBatches.id, batchId))
          .returning();

        if (!row) {
          this.logger.warn(`[updateBatchCountersAtomic] batch not found: ${batchId}`);
          return null;
        }

        return this.mapBatch(row);
      },
      { batchId },
    );
  }

  private mapBatch(row: typeof schema.importBatches.$inferSelect): ImportBatch {
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

  private mapItem(row: typeof schema.importPendingItems.$inferSelect): ImportPendingItem {
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
}
