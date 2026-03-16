import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { type Queue } from 'bullmq';

import { BACKFILL_QUEUE, IngestionJob } from '../../ingestion/ingestion.constants';
import {
  IMPORT_BATCH_STATUS,
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
   * Creates pending batches for not-found import items and queues dispatcher jobs.
   *
   * Splits items into chunks of MAX_PENDING_ITEMS_PER_BATCH to stay within
   * DB insert limits. Returns all created batches.
   */
  async createPendingBatches(
    userId: string,
    source: string,
    items: ExternalMediaEntry[],
  ): Promise<ImportBatch[]> {
    const batches: ImportBatch[] = [];

    for (let i = 0; i < items.length; i += MAX_PENDING_ITEMS_PER_BATCH) {
      const chunk = items.slice(i, i + MAX_PENDING_ITEMS_PER_BATCH);

      try {
        const batch = await this.pendingRepo.createBatchWithItems(
          { userId, source, totalItems: chunk.length },
          chunk.map((item) => ({
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
          this.logger.error(
            `Failed to queue dispatcher for batch ${batch.id}, batch is orphaned: ${(error as Error).message}`,
          );
          throw error;
        }

        batches.push(batch);
      } catch (error) {
        const droppedItems = items.length - i;
        this.logger.error(
          `Failed at chunk offset=${i} userId=${userId}: ${(error as Error).message}. ` +
            `${droppedItems} items in subsequent chunks dropped.`,
          (error as Error).stack,
        );
        break;
      }
    }

    if (batches.length === 0) {
      throw new InternalServerErrorException(
        `Failed to create any pending batches for userId=${userId}`,
      );
    }

    this.logger.log(
      `Created ${batches.length} pending batch(es) userId=${userId} totalItems=${items.length}`,
    );

    return batches;
  }

  /**
   * Returns the most recent import batches for a user.
   */
  async getUserBatches(userId: string): Promise<ImportBatch[]> {
    return this.pendingRepo.findActiveBatchesByUser(userId, USER_BATCHES_LIMIT);
  }

  /**
   * Cancels a batch and all its non-terminal items.
   *
   * Idempotent — calling on an already-cancelled batch is a no-op.
   * Throws NotFoundException when the batch does not exist or belongs to a different user.
   */
  async cancelBatch(userId: string, batchId: string): Promise<void> {
    const batch = await this.pendingRepo.findBatchById(batchId);
    if (!batch || batch.userId !== userId) {
      throw new NotFoundException(`Batch ${batchId} not found`);
    }
    if (
      batch.status === IMPORT_BATCH_STATUS.CANCELLED ||
      batch.status === IMPORT_BATCH_STATUS.COMPLETED
    )
      return;
    await this.pendingRepo.cancelBatch(batchId);
    this.logger.log(`Batch ${batchId} cancelled by userId=${userId}`);
  }
}
