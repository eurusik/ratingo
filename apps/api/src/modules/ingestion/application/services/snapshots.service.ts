import { Injectable, Logger, Inject } from '@nestjs/common';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { type SnapshotCandidate } from '../../../catalog/public';
import { type TraktRatingsPort, TRAKT_RATINGS_PORT, TRAKT_MEDIA_TYPE } from '../../../trakt/public';
import {
  type ISnapshotsRepository,
  SNAPSHOTS_REPOSITORY,
  type SnapshotUpsertData,
} from '../../domain/repositories/snapshots.repository.interface';

/**
 * Result of batch snapshot sync operation.
 */
export interface SnapshotBatchResult {
  synced: number;
  skipped: number;
  errors: number;
}

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
    @Inject(TRAKT_RATINGS_PORT)
    private readonly traktAdapter: TraktRatingsPort,
    @Inject(SNAPSHOTS_REPOSITORY)
    private readonly snapshotsRepository: ISnapshotsRepository,
  ) {}

  /**
   * Syncs snapshots for multiple items using optimized batch API calls.
   * Uses 2 API calls per item (search + stats).
   *
   * @param candidates - Array of snapshot candidates from repository
   * @param snapshotDate - The normalized UTC date for snapshots
   * @param region - Region code (default: 'global')
   * @returns Batch result with counts
   */
  async syncSnapshotBatch(
    candidates: SnapshotCandidate[],
    snapshotDate: Date,
    region: string,
  ): Promise<SnapshotBatchResult> {
    if (candidates.length === 0) {
      return { synced: 0, skipped: 0, errors: 0 };
    }

    const movies = candidates.filter((c) => c.type === MediaType.MOVIE);
    const shows = candidates.filter((c) => c.type === MediaType.SHOW);

    // Fetch total watchers in parallel for movies and shows
    const [movieWatchers, showWatchers] = await Promise.all([
      movies.length > 0
        ? this.traktAdapter.getTotalWatchersByTmdbIds(
            TRAKT_MEDIA_TYPE.MOVIE,
            movies.map((m) => m.tmdbId),
          )
        : new Map<number, number | null | undefined>(),
      shows.length > 0
        ? this.traktAdapter.getTotalWatchersByTmdbIds(
            TRAKT_MEDIA_TYPE.SHOW,
            shows.map((s) => s.tmdbId),
          )
        : new Map<number, number | null | undefined>(),
    ]);

    // Build snapshots to upsert
    const snapshotsToUpsert: SnapshotUpsertData[] = [];
    let skipped = 0;
    let errors = 0;

    for (const candidate of candidates) {
      const watchers =
        candidate.type === MediaType.MOVIE
          ? movieWatchers.get(candidate.tmdbId)
          : showWatchers.get(candidate.tmdbId);

      if (typeof watchers === 'number') {
        snapshotsToUpsert.push({
          mediaItemId: candidate.id,
          snapshotDate,
          totalWatchers: watchers,
          region,
        });
      } else if (watchers === undefined) {
        skipped++; // Not found in Trakt
      } else {
        errors++; // Transient error
      }
    }

    // Bulk upsert all snapshots
    if (snapshotsToUpsert.length > 0) {
      await this.snapshotsRepository.bulkUpsertSnapshots(snapshotsToUpsert);
    }

    return {
      synced: snapshotsToUpsert.length,
      skipped,
      errors,
    };
  }
}
