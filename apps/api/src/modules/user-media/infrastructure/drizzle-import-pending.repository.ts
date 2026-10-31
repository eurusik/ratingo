import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  notExists,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../common/enums/ingestion-status.enum';
import { withDbError } from '../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  IMPORT_BATCH_STATUS,
  IMPORT_PENDING_FAILURE,
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
  type LinkableItemsQuery,
  type PendingMediaLink,
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
          .where(
            and(
              eq(schema.importBatches.userId, userId),
              eq(schema.importBatches.status, IMPORT_BATCH_STATUS.PROCESSING),
            ),
          )
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

  async findLinkableWithReadyMedia({
    ingestingBefore,
    staleLinkingBefore,
    limit,
  }: LinkableItemsQuery): Promise<PendingMediaLink[]> {
    return withDbError(
      'find linkable pending items with ready media',
      this.logger,
      async () => {
        const rows = await this.db
          .select({ item: schema.importPendingItems, mediaItemId: schema.mediaItems.id })
          .from(schema.importPendingItems)
          .innerJoin(schema.mediaItems, this.readyMediaFor())
          .where(this.isLinkable(ingestingBefore, staleLinkingBefore))
          .orderBy(asc(schema.importPendingItems.updatedAt))
          .limit(limit);
        return rows.map((row) => ({ item: this.mapItem(row.item), mediaItemId: row.mediaItemId }));
      },
      {
        ingestingBefore: ingestingBefore.toISOString(),
        staleLinkingBefore: staleLinkingBefore.toISOString(),
        limit,
      },
    );
  }

  async claimForLinking(itemId: string, staleLinkingBefore: Date): Promise<boolean> {
    return withDbError(
      'claim pending item for linking',
      this.logger,
      async () => {
        const claimed = await this.db
          .update(schema.importPendingItems)
          .set({ status: IMPORT_PENDING_STATUS.LINKING, updatedAt: new Date() })
          .where(
            and(
              eq(schema.importPendingItems.id, itemId),
              or(
                eq(schema.importPendingItems.status, IMPORT_PENDING_STATUS.INGESTING),
                this.isStaleLinking(staleLinkingBefore),
              ),
            ),
          )
          .returning({ id: schema.importPendingItems.id });
        return claimed.length > 0;
      },
      { itemId },
    );
  }

  async failIngestingUpdatedBefore(before: Date, limit: number): Promise<string[]> {
    return withDbError(
      'fail timed-out ingesting items',
      this.logger,
      async () => {
        const timedOut = this.db
          .select({ id: schema.importPendingItems.id })
          .from(schema.importPendingItems)
          .where(
            and(
              eq(schema.importPendingItems.status, IMPORT_PENDING_STATUS.INGESTING),
              lt(schema.importPendingItems.updatedAt, before),
              notExists(
                this.db
                  .select({ id: schema.mediaItems.id })
                  .from(schema.mediaItems)
                  .where(this.readyMediaFor()),
              ),
            ),
          )
          .limit(limit);

        const failed = await this.db
          .update(schema.importPendingItems)
          .set({
            status: IMPORT_PENDING_STATUS.FAILED,
            failureReason: IMPORT_PENDING_FAILURE.INGEST_FAILED,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(schema.importPendingItems.id, timedOut),
              eq(schema.importPendingItems.status, IMPORT_PENDING_STATUS.INGESTING),
            ),
          )
          .returning({ batchId: schema.importPendingItems.batchId });
        return failed.map((row) => row.batchId);
      },
      { before: before.toISOString(), limit },
    );
  }

  async updateItemStatus(itemId: string, update: UpdatePendingItemInput): Promise<void> {
    return withDbError(
      'update pending item status',
      this.logger,
      async () => {
        await this.db
          .update(schema.importPendingItems)
          .set(this.toItemUpdateValues(update))
          .where(eq(schema.importPendingItems.id, itemId));
      },
      { itemId, status: update.status },
    );
  }

  async updateItemStatusIfNotCancelled(
    itemId: string,
    update: UpdatePendingItemInput,
  ): Promise<boolean> {
    return withDbError(
      'update pending item status if not cancelled',
      this.logger,
      async () => {
        const result = await this.db
          .update(schema.importPendingItems)
          .set(this.toItemUpdateValues(update))
          .where(
            and(
              eq(schema.importPendingItems.id, itemId),
              ne(schema.importPendingItems.status, IMPORT_PENDING_STATUS.CANCELLED),
            ),
          )
          .returning({ id: schema.importPendingItems.id });

        return result.length > 0;
      },
      { itemId, status: update.status },
    );
  }

  async transitionItemStatus(
    itemId: string,
    from: ImportPendingItemStatus,
    update: UpdatePendingItemInput,
  ): Promise<boolean> {
    return withDbError(
      'transition pending item status',
      this.logger,
      async () => {
        const result = await this.db
          .update(schema.importPendingItems)
          .set(this.toItemUpdateValues(update))
          .where(
            and(
              eq(schema.importPendingItems.id, itemId),
              eq(schema.importPendingItems.status, from),
            ),
          )
          .returning({ id: schema.importPendingItems.id });

        return result.length > 0;
      },
      { itemId, from, status: update.status },
    );
  }

  async cancelBatch(batchId: string): Promise<void> {
    return withDbError(
      'cancel import batch',
      this.logger,
      async () => {
        await this.db.transaction(async (tx) => {
          // Cancel all non-terminal items (leave DONE, FAILED and in-flight LINKING untouched)
          await tx
            .update(schema.importPendingItems)
            .set({ status: IMPORT_PENDING_STATUS.CANCELLED, updatedAt: new Date() })
            .where(
              and(
                eq(schema.importPendingItems.batchId, batchId),
                notInArray(schema.importPendingItems.status, [
                  IMPORT_PENDING_STATUS.DONE,
                  IMPORT_PENDING_STATUS.FAILED,
                  IMPORT_PENDING_STATUS.LINKING,
                ]),
              ),
            );

          // Mark batch as cancelled
          await tx
            .update(schema.importBatches)
            .set({ status: IMPORT_BATCH_STATUS.CANCELLED, updatedAt: new Date() })
            .where(eq(schema.importBatches.id, batchId));
        });
      },
      { batchId },
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
                  AND status NOT IN (${IMPORT_PENDING_STATUS.DONE}, ${IMPORT_PENDING_STATUS.FAILED}, ${IMPORT_PENDING_STATUS.CANCELLED})
              ) = 0 THEN ${IMPORT_BATCH_STATUS.COMPLETED}::import_batch_status
              ELSE ${IMPORT_BATCH_STATUS.PROCESSING}::import_batch_status
            END`,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(schema.importBatches.id, batchId),
              ne(schema.importBatches.status, IMPORT_BATCH_STATUS.CANCELLED),
            ),
          )
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

  private readyMediaFor() {
    return and(
      eq(schema.mediaItems.tmdbId, schema.importPendingItems.resolvedTmdbId),
      sql`${schema.mediaItems.type}::text = ${schema.importPendingItems.mediaType}`,
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
    );
  }

  private isStaleLinking(staleLinkingBefore: Date) {
    return and(
      eq(schema.importPendingItems.status, IMPORT_PENDING_STATUS.LINKING),
      lt(schema.importPendingItems.updatedAt, staleLinkingBefore),
    );
  }

  private isLinkable(ingestingBefore: Date, staleLinkingBefore: Date) {
    return or(
      and(
        eq(schema.importPendingItems.status, IMPORT_PENDING_STATUS.INGESTING),
        lt(schema.importPendingItems.updatedAt, ingestingBefore),
      ),
      this.isStaleLinking(staleLinkingBefore),
    );
  }

  private toItemUpdateValues(update: UpdatePendingItemInput): Record<string, unknown> {
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
