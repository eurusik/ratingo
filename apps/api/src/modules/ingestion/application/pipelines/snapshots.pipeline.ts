import { Injectable, Logger, Inject } from '@nestjs/common';

import { formatUtcDayId, utcDateFromDayId } from '@/common/utils/date.util';

import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import { SNAPSHOTS_BATCH_SIZE, SNAPSHOTS_RUN_CAP } from '../../ingestion.constants';
import { normalizeRegion } from '../helpers/queue.helpers';
import { SnapshotsService } from '../services/snapshots.service';

/**
 * Snapshots pipeline: daily snapshot sync for ELIGIBLE media items only.
 *
 * Uses batch processing with cursor pagination for memory efficiency.
 * Optimized to reduce Trakt API calls by ~95% compared to previous approach.
 */
@Injectable()
export class SnapshotsPipeline {
  private readonly logger = new Logger(SnapshotsPipeline.name);

  constructor(
    private readonly snapshotsService: SnapshotsService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Dispatches snapshot sync for ELIGIBLE media items only.
   * Uses batch processing for efficiency and rate limit compliance.
   *
   * @param region - Region code for snapshots (default: 'global')
   */
  async dispatch(region = 'global'): Promise<void> {
    const normalizedRegion = normalizeRegion(region);
    const today = formatUtcDayId();
    const snapshotDate = utcDateFromDayId(today);

    this.logger.log(
      `Starting snapshots dispatcher (region: ${normalizedRegion}, date: ${today})...`,
    );

    let cursor: string | undefined;
    let totalProcessed = 0;
    let totalSynced = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let batchCount = 0;

    while (totalProcessed < SNAPSHOTS_RUN_CAP) {
      const remaining = SNAPSHOTS_RUN_CAP - totalProcessed;
      const batchLimit = Math.min(SNAPSHOTS_BATCH_SIZE, remaining);

      const candidates = await this.mediaRepository.findSnapshotCandidates({
        limit: batchLimit,
        cursor,
      });

      if (candidates.length === 0) break;

      cursor = candidates[candidates.length - 1].id;
      batchCount++;
      totalProcessed += candidates.length;

      const result = await this.snapshotsService.syncSnapshotBatch(
        candidates,
        snapshotDate,
        normalizedRegion,
      );

      totalSynced += result.synced;
      totalSkipped += result.skipped;
      totalErrors += result.errors;

      this.logger.debug(
        `Batch ${batchCount} complete: synced=${result.synced}, ` +
          `skipped=${result.skipped}, errors=${result.errors}`,
      );
    }

    if (totalProcessed >= SNAPSHOTS_RUN_CAP) {
      this.logger.log(
        `Snapshots dispatcher hit run cap (${SNAPSHOTS_RUN_CAP}); ` +
          `batches=${batchCount}, synced=${totalSynced}, skipped=${totalSkipped}, errors=${totalErrors}. ` +
          `Remaining candidates will be picked up on next run.`,
      );
    } else {
      this.logger.log(
        `Snapshots dispatcher complete: batches=${batchCount}, ` +
          `synced=${totalSynced}, skipped=${totalSkipped}, errors=${totalErrors}`,
      );
    }
  }
}
