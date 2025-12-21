import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SnapshotsService } from '../services/snapshots.service';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { formatUtcDayId, utcDateFromDayId } from '@/common/utils/date.util';
import { preDedupeBulk, formatSample } from '../helpers/queue.helpers';

/**
 * Snapshots pipeline: handles daily snapshot sync for all media items.
 * Uses cursor pagination and job-level deduplication.
 */
@Injectable()
export class SnapshotsPipeline {
  private readonly logger = new Logger(SnapshotsPipeline.name);
  private readonly CHECK_CONCURRENCY = 50;
  private readonly BATCH_SIZE = 500;

  constructor(
    private readonly snapshotsService: SnapshotsService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Normalizes region string for consistent jobId generation.
   */
  private normalizeRegion(region?: string): string {
    if (!region) return 'global';
    if (region.toLowerCase() === 'global') return 'global';
    const sanitized = region.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    return sanitized.length > 0 ? sanitized : 'global';
  }

  /**
   * Dispatcher: iterates over all media items using cursor pagination,
   * checks for existing jobs, and enqueues snapshot item jobs.
   */
  async dispatch(region = 'global'): Promise<void> {
    const normalizedRegion = this.normalizeRegion(region);
    const today = formatUtcDayId();
    let cursor: string | undefined;

    let found = 0;
    let enqueued = 0;
    let deduped = 0;

    this.logger.log(
      `Starting snapshots dispatcher (region: ${normalizedRegion}, date: ${today})...`,
    );

    while (true) {
      const ids = await this.mediaRepository.findIdsForSnapshots({
        limit: this.BATCH_SIZE,
        cursor,
      });

      if (ids.length === 0) break;

      found += ids.length;
      cursor = ids[ids.length - 1];

      const jobs = ids.map((mediaItemId) => ({
        name: IngestionJob.SYNC_SNAPSHOT_ITEM,
        data: { mediaItemId, region: normalizedRegion, dayId: today },
        opts: { jobId: `snapshot_${mediaItemId}_${today}_${normalizedRegion}` },
      }));

      const {
        jobsToAdd,
        deduped: batchDeduped,
        sample,
      } = await preDedupeBulk(jobs, this.ingestionQueue, this.CHECK_CONCURRENCY);

      deduped += batchDeduped;

      if (jobsToAdd.length > 0) {
        await this.ingestionQueue.addBulk(jobsToAdd);
        enqueued += jobsToAdd.length;
      }

      this.logger.log(
        `Snapshots dispatcher progress: found=${found}, enqueued=${enqueued}, deduped=${deduped}${formatSample(sample)}`,
      );
    }

    this.logger.log(
      `Snapshots dispatcher complete: found=${found}, enqueued=${enqueued}, deduped=${deduped}`,
    );
  }

  /**
   * Processes a single snapshot item job.
   */
  async processItem(mediaItemId: string, dayId: string, region: string): Promise<void> {
    const normalizedRegion = this.normalizeRegion(region);
    let snapshotDate: Date;
    try {
      snapshotDate = utcDateFromDayId(dayId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown dayId parsing error';
      throw new Error(
        `Invalid snapshot dayId payload (mediaItemId=${mediaItemId}, region=${normalizedRegion}, dayId=${dayId}): ${message}`,
      );
    }
    await this.snapshotsService.syncSnapshotItem(mediaItemId, snapshotDate, normalizedRegion);
  }
}
