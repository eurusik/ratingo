import { Injectable, Logger, Inject } from '@nestjs/common';

import { MediaType } from '../../../../common/enums/media-type.enum';
import {
  type ISnapshotsRepository,
  SNAPSHOTS_REPOSITORY,
} from '../../domain/repositories/snapshots.repository.interface';
import { TraktRatingsAdapter } from '../../infrastructure/adapters/trakt/trakt-ratings.adapter';

/**
 * Service for managing daily snapshots of media metrics.
 *
 * Captures point-in-time watchers data for all active media items so that
 * trends and movements can be analyzed later (e.g. in Insights module).
 */
@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(
    private readonly traktAdapter: TraktRatingsAdapter,
    @Inject(SNAPSHOTS_REPOSITORY)
    private readonly snapshotsRepository: ISnapshotsRepository,
  ) {}

  /**
   * Syncs a single watcher snapshot for a specific media item.
   *
   * Fetches current watchers stats from Trakt and upserts a snapshot row.
   * Designed to be idempotent for the same UTC day.
   *
   * @param mediaItemId - The ID of the media item to sync
   * @param snapshotDate - The normalized date for the snapshot (00:00 UTC)
   * @param region - The region code (default: 'global')
   */
  async syncSnapshotItem(
    mediaItemId: string,
    snapshotDate: Date,
    region = 'global',
  ): Promise<void> {
    try {
      // 1. Get minimal media info to know which Trakt endpoint to call
      const item = await this.snapshotsRepository.findMediaItemForSnapshot(mediaItemId);

      if (!item) {
        this.logger.warn(`Media item ${mediaItemId} not found for snapshot sync.`);
        return;
      }

      // 2. Fetch stats from Trakt
      const stats =
        item.type === MediaType.MOVIE
          ? await this.traktAdapter.getMovieRatingsByTmdbId(item.tmdbId)
          : await this.traktAdapter.getShowRatingsByTmdbId(item.tmdbId);

      if (stats) {
        // 3. Upsert snapshot
        await this.snapshotsRepository.upsertSnapshot({
          mediaItemId,
          snapshotDate,
          totalWatchers: stats.totalWatchers,
          region,
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to sync snapshot for item ${mediaItemId}: ${(e as Error).message}`);
      throw e; // Rethrow so worker can retry
    }
  }
}
