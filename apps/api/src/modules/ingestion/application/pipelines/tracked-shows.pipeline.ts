import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TrackedSyncService } from '../services/tracked-sync.service';
import { SubscriptionTriggerService } from '../../../user-actions/application/subscription-trigger.service';
import {
  IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../../../user-actions/domain/repositories/user-subscription.repository.interface';
import {
  INGESTION_QUEUE,
  IngestionJob,
  TRACKED_SHOWS_CHUNK_SIZE,
  TMDB_REQUEST_DELAY_MS,
} from '../../ingestion.constants';
import { preDedupeBulk, hashIds, formatHourWindow, formatSample } from '../helpers/queue.helpers';

/**
 * Tracked shows pipeline: syncs shows with active subscriptions,
 * detects diffs (new episodes/seasons), and triggers notifications.
 */
@Injectable()
export class TrackedShowsPipeline {
  private readonly logger = new Logger(TrackedShowsPipeline.name);
  private readonly CHECK_CONCURRENCY = 50;

  constructor(
    private readonly trackedSyncService: TrackedSyncService,
    private readonly subscriptionTriggerService: SubscriptionTriggerService,
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Dispatcher: fetches tracked show IDs and queues batch jobs.
   * Uses stable hash-based jobIds for deterministic deduplication.
   */
  async dispatch(window?: string): Promise<void> {
    this.logger.log('Starting tracked shows sync dispatcher...');

    const effectiveWindow = window || formatHourWindow();

    const tmdbIds = await this.subscriptionRepository.findTrackedShowTmdbIds();
    this.logger.log(`Found ${tmdbIds.length} tracked shows to sync`);

    if (tmdbIds.length === 0) return;

    const chunks: number[][] = [];
    for (let i = 0; i < tmdbIds.length; i += TRACKED_SHOWS_CHUNK_SIZE) {
      chunks.push(tmdbIds.slice(i, i + TRACKED_SHOWS_CHUNK_SIZE));
    }

    const BULK_LIMIT = 10;
    let deduped = 0;
    let enqueued = 0;

    for (let i = 0; i < chunks.length; i += BULK_LIMIT) {
      const batchChunks = chunks.slice(i, i + BULK_LIMIT);

      const candidateJobs = batchChunks.map((chunkTmdbIds) => ({
        name: IngestionJob.SYNC_TRACKED_SHOW_BATCH,
        data: { tmdbIds: chunkTmdbIds },
        opts: { jobId: `tracked_batch_${effectiveWindow}_${hashIds(chunkTmdbIds)}` },
      }));

      const {
        jobsToAdd,
        deduped: batchDeduped,
        sample,
      } = await preDedupeBulk(candidateJobs, this.ingestionQueue, this.CHECK_CONCURRENCY);

      deduped += batchDeduped;

      if (jobsToAdd.length > 0) {
        await this.ingestionQueue.addBulk(jobsToAdd);
        enqueued += jobsToAdd.length;
      }

      this.logger.log(
        `Tracked shows dispatcher progress: batches=${chunks.length}, shows=${tmdbIds.length}, enqueued=${enqueued}, deduped=${deduped}${formatSample(sample)}`,
      );
    }

    this.logger.log(
      `Tracked shows dispatcher complete: batches=${chunks.length}, shows=${tmdbIds.length}, enqueued=${enqueued}, deduped=${deduped}`,
    );
  }

  /**
   * Processes a batch of tracked shows with diff detection and notification triggering.
   */
  async processBatch(tmdbIds: number[]): Promise<void> {
    this.logger.log(`Processing tracked show batch: ${tmdbIds.length} shows`);

    let processed = 0;
    let withChanges = 0;

    for (const tmdbId of tmdbIds) {
      try {
        const diff = await this.trackedSyncService.syncShowWithDiff(tmdbId);

        if (diff.hasChanges) {
          withChanges++;
          const events = await this.subscriptionTriggerService.handleShowDiff(diff);
          if (events.length > 0) {
            this.logger.log(`Show ${tmdbId}: ${events.length} notifications generated`);
          }
        }

        processed++;

        if (processed < tmdbIds.length) {
          await this.delay(TMDB_REQUEST_DELAY_MS);
        }
      } catch (error) {
        this.logger.error(`Failed to sync tracked show ${tmdbId}: ${error.message}`);
      }
    }

    this.logger.log(
      `Tracked show batch complete: ${processed}/${tmdbIds.length} processed, ${withChanges} with changes`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
