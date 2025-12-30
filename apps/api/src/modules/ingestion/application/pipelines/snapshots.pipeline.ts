import { Injectable, Logger, Inject } from '@nestjs/common';
import { SnapshotsService } from '../services/snapshots.service';
import { BulkJobService, BulkEnqueueResult } from '../services/bulk-job.service';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { IngestionJob } from '../../ingestion.constants';
import { formatUtcDayId, utcDateFromDayId } from '@/common/utils/date.util';

/**
 * Snapshots pipeline: daily snapshot sync for all media items.
 *
 * Uses cursor pagination and job-level deduplication.
 */
@Injectable()
export class SnapshotsPipeline {
  private readonly logger = new Logger(SnapshotsPipeline.name);
  private readonly BATCH_SIZE = 500;

  constructor(
    private readonly snapshotsService: SnapshotsService,
    private readonly bulkJobService: BulkJobService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Dispatches snapshot jobs for all media items.
   *
   * @param region - Region code for snapshots (default: 'global')
   */
  async dispatch(region = 'global'): Promise<void> {
    const normalizedRegion = this.normalizeRegion(region);
    const today = formatUtcDayId();

    this.logger.log(
      `Starting snapshots dispatcher (region: ${normalizedRegion}, date: ${today})...`,
    );

    let cursor: string | undefined;
    let result: BulkEnqueueResult = { found: 0, enqueued: 0, deduped: 0 };

    while (true) {
      const ids = await this.mediaRepository.findIdsForSnapshots({
        limit: this.BATCH_SIZE,
        cursor,
      });

      if (ids.length === 0) break;

      cursor = ids[ids.length - 1];

      const jobs = ids.map((mediaItemId) => ({
        name: IngestionJob.SYNC_SNAPSHOT_ITEM,
        data: { mediaItemId, region: normalizedRegion, dayId: today },
        opts: { jobId: `snapshot_${mediaItemId}_${today}_${normalizedRegion}` },
      }));

      result = await this.bulkJobService.enqueueBatch(
        jobs,
        this.logger,
        'Snapshots dispatcher',
        result,
      );
    }

    this.logger.log(
      `Snapshots dispatcher complete: found=${result.found}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }

  /** Processes a single snapshot item job. */
  async processItem(mediaItemId: string, dayId: string, region: string): Promise<void> {
    const normalizedRegion = this.normalizeRegion(region);

    let snapshotDate: Date;
    try {
      snapshotDate = utcDateFromDayId(dayId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown dayId parsing error';
      throw new Error(
        `Invalid snapshot dayId (mediaItemId=${mediaItemId}, region=${normalizedRegion}, dayId=${dayId}): ${message}`,
      );
    }

    await this.snapshotsService.syncSnapshotItem(mediaItemId, snapshotDate, normalizedRegion);
  }

  /** Normalizes region string for consistent jobId generation. */
  private normalizeRegion(region?: string): string {
    if (!region) return 'global';
    if (region.toLowerCase() === 'global') return 'global';
    const sanitized = region.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    return sanitized.length > 0 ? sanitized : 'global';
  }
}
