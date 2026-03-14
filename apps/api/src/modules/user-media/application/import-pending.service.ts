import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { BACKFILL_QUEUE, IngestionJob } from '../../ingestion/ingestion.constants';
import {
  IMPORT_PENDING_REPOSITORY,
  MAX_PENDING_ITEMS_PER_BATCH,
  USER_BATCHES_LIMIT,
} from '../domain/constants/import-pending.constants';
import { type ExternalMediaEntry } from '../domain/entities/external-media-entry';
import { type ImportBatch } from '../domain/entities/import-batch';
import { type IImportPendingRepository } from '../domain/repositories/import-pending.repository.interface';

/**
 * Application service for managing import pending batches.
 *
 * Creates batches of not-found import items and queues background jobs
 * to resolve them via TMDB and ingest them into the catalog.
 */
@Injectable()
export class ImportPendingService {
  private readonly logger = new Logger(ImportPendingService.name);

  constructor(
    @Inject(IMPORT_PENDING_REPOSITORY)
    private readonly pendingRepo: IImportPendingRepository,
    @InjectQueue(BACKFILL_QUEUE)
    private readonly backfillQueue: Queue,
  ) {}

  /**
   * Creates a pending batch for not-found import items and queues the dispatcher job.
   *
   * Enforces MAX_PENDING_ITEMS_PER_BATCH — excess items are silently dropped.
   * The dispatcher will fan-out one RESOLVE_IMPORT_ITEM job per item.
   */
  async createPendingBatch(
    userId: string,
    source: string,
    items: ExternalMediaEntry[],
  ): Promise<ImportBatch> {
    const capped = items.slice(0, MAX_PENDING_ITEMS_PER_BATCH);

    if (items.length > MAX_PENDING_ITEMS_PER_BATCH) {
      this.logger.warn(
        `Import pending batch capped at ${MAX_PENDING_ITEMS_PER_BATCH} items ` +
          `(${items.length - MAX_PENDING_ITEMS_PER_BATCH} items dropped) for userId=${userId}`,
      );
    }

    const batch = await this.pendingRepo.createBatchWithItems(
      { userId, source, totalItems: capped.length },
      capped.map((item) => ({
        imdbId: item.imdbId ?? null,
        tmdbId: item.tmdbId ?? null,
        title: item.title ?? null,
        rating: item.rating ?? null,
        state: item.state,
      })),
    );

    try {
      await this.backfillQueue.add(
        IngestionJob.RESOLVE_IMPORT_DISPATCHER,
        { batchId: batch.id },
        { jobId: `resolve-import-${batch.id}` },
      );
    } catch (error) {
      // If queue add fails, the batch exists in DB but has no dispatcher job.
      // The error propagates to ImportMediaService which logs it.
      // TODO: Add a periodic cleanup job for orphaned batches
      //       (status=processing, created > 1h ago, no active queue job).
      this.logger.error(
        `Failed to queue dispatcher for batch ${batch.id}, batch is orphaned: ${(error as Error).message}`,
      );
      throw error;
    }

    this.logger.log(
      `Created pending batch batchId=${batch.id} userId=${userId} items=${capped.length}`,
    );

    return batch;
  }

  /**
   * Returns the most recent import batches for a user.
   */
  async getUserBatches(userId: string): Promise<ImportBatch[]> {
    return this.pendingRepo.findActiveBatchesByUser(userId, USER_BATCHES_LIMIT);
  }
}
