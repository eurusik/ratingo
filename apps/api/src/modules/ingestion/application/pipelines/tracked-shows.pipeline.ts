import { Injectable, Logger, Inject } from '@nestjs/common';

import {
  SubscriptionTriggerService,
  type IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../../../user-actions/public';
import {
  IngestionJob,
  TRACKED_SHOWS_CHUNK_SIZE,
  TRACKED_SHOWS_BULK_LIMIT,
  TMDB_REQUEST_DELAY_MS,
} from '../../ingestion.constants';
import { hashIds, formatHourWindow, chunkArray } from '../helpers/queue.helpers';
import { BulkJobService, type BulkEnqueueResult } from '../services/bulk-job.service';
import { TrackedSyncService } from '../services/tracked-sync.service';

/**
 * Tracked shows pipeline: syncs shows with active subscriptions.
 *
 * Detects diffs (new episodes/seasons) and triggers notifications.
 */
@Injectable()
export class TrackedShowsPipeline {
  private readonly logger = new Logger(TrackedShowsPipeline.name);

  constructor(
    private readonly trackedSyncService: TrackedSyncService,
    private readonly bulkJobService: BulkJobService,
    private readonly subscriptionTriggerService: SubscriptionTriggerService,
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  /**
   * Dispatches batch jobs for tracked shows.
   *
   * Uses stable hash-based jobIds for deterministic deduplication.
   *
   * @param window - Hour window for deduplication (default: current hour)
   */
  async dispatch(window?: string): Promise<void> {
    this.logger.log('Starting tracked shows sync dispatcher...');

    const effectiveWindow = window || formatHourWindow();

    const tmdbIds = await this.subscriptionRepository.findTrackedShowTmdbIds();
    this.logger.log(`Found ${tmdbIds.length} tracked shows to sync`);

    if (tmdbIds.length === 0) return;

    const chunks = chunkArray(tmdbIds, TRACKED_SHOWS_CHUNK_SIZE);
    let result: BulkEnqueueResult = { found: 0, enqueued: 0, deduped: 0 };

    for (let i = 0; i < chunks.length; i += TRACKED_SHOWS_BULK_LIMIT) {
      const batchChunks = chunks.slice(i, i + TRACKED_SHOWS_BULK_LIMIT);

      const jobs = batchChunks.map((chunkTmdbIds) => ({
        name: IngestionJob.SYNC_TRACKED_SHOW_BATCH,
        data: { tmdbIds: chunkTmdbIds },
        opts: { jobId: `tracked_batch_${effectiveWindow}_${hashIds(chunkTmdbIds)}` },
      }));

      result = await this.bulkJobService.enqueueBatch(
        jobs,
        this.logger,
        `Tracked shows (${tmdbIds.length} shows, ${chunks.length} batches)`,
        result,
      );
    }

    this.logger.log(
      `Tracked shows dispatcher complete: batches=${chunks.length}, shows=${tmdbIds.length}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }

  /** Processes a batch of tracked shows with diff detection. */
  async processBatch(tmdbIds: number[]): Promise<void> {
    this.logger.log(`Processing tracked show batch: ${tmdbIds.length} shows`);

    let processed = 0;
    let withChanges = 0;

    for (const tmdbId of tmdbIds) {
      const result = await this.processTrackedShow(tmdbId);
      if (result.hasChanges) withChanges++;
      processed++;

      if (processed < tmdbIds.length) {
        await this.delay(TMDB_REQUEST_DELAY_MS);
      }
    }
    this.logger.log(
      `Tracked show batch complete: ${processed}/${tmdbIds.length} processed, ${withChanges} with changes`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Processes a single tracked show with diff detection.
   */
  private async processTrackedShow(tmdbId: number): Promise<{ hasChanges: boolean }> {
    try {
      const diff = await this.trackedSyncService.syncShowWithDiff(tmdbId);

      if (diff.hasChanges) {
        const events = await this.subscriptionTriggerService.handleShowDiff(diff);
        if (events.length > 0) {
          this.logger.log(`Show ${tmdbId}: ${events.length} notifications generated`);
        }
      }

      return { hasChanges: diff.hasChanges };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to sync tracked show ${tmdbId}: ${err.message}`);
      return { hasChanges: false };
    }
  }
}
