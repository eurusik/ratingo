import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { BACKFILL_QUEUE, IngestionJob } from '../../../ingestion/ingestion.constants';
import {
  IMPORT_BATCH_STATUS,
  IMPORT_PENDING_REPOSITORY,
  IMPORT_PENDING_STATUS,
} from '../../domain/constants/import-pending.constants';
import { type IImportPendingRepository } from '../../domain/repositories/import-pending.repository.interface';

/** Stagger delay between RESOLVE_IMPORT_ITEM jobs to stay below TMDB's 4 req/s limit. */
const RESOLVE_STAGGER_MS = 350;

/**
 * Pipeline for the RESOLVE_IMPORT_DISPATCHER job.
 *
 * Loads all pending items for a batch and fans out one RESOLVE_IMPORT_ITEM job per item.
 * Matches the BACKFILL_IMDB_DISPATCHER / BACKFILL_IMDB_ITEM pattern.
 *
 * Jobs are staggered by {@link RESOLVE_STAGGER_MS} to avoid TMDB rate limit bursts.
 * Runs on the backfill queue: TMDB-only, no Trakt/OMDb rate limiting.
 */
@Injectable()
export class ResolveImportDispatcherPipeline {
  private readonly logger = new Logger(ResolveImportDispatcherPipeline.name);

  constructor(
    @Inject(IMPORT_PENDING_REPOSITORY)
    private readonly pendingRepo: IImportPendingRepository,
    @InjectQueue(BACKFILL_QUEUE)
    private readonly backfillQueue: Queue,
  ) {}

  /**
   * Loads pending items for the batch and queues one RESOLVE_IMPORT_ITEM job per item.
   * Uses jobId for deduplication — safe to re-run if the dispatcher is retried.
   */
  async execute(data: { batchId: string }): Promise<void> {
    const { batchId } = data;

    const batch = await this.pendingRepo.findBatchById(batchId);
    if (!batch) {
      this.logger.warn(`[dispatcher] batchId=${batchId} not found, skipping`);
      return;
    }
    if (batch.status === IMPORT_BATCH_STATUS.CANCELLED) {
      this.logger.log(`[dispatcher] batchId=${batchId} is cancelled, skipping`);
      return;
    }

    const items = await this.pendingRepo.findPendingByBatchAndStatus(
      batchId,
      IMPORT_PENDING_STATUS.PENDING,
    );

    if (items.length === 0) {
      this.logger.debug(`[dispatcher] batchId=${batchId}: no pending items, skipping`);
      return;
    }

    const jobs = items.map((item, index) => ({
      name: IngestionJob.RESOLVE_IMPORT_ITEM,
      data: { pendingItemId: item.id, batchId },
      opts: {
        jobId: `resolve-import-item-${item.id}`,
        delay: index * RESOLVE_STAGGER_MS,
      },
    }));

    await this.backfillQueue.addBulk(jobs);

    this.logger.log(
      `[dispatcher] batchId=${batchId}: queued ${jobs.length} RESOLVE_IMPORT_ITEM jobs`,
    );
  }
}
