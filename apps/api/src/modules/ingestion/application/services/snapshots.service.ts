import { Injectable, Logger, Inject } from '@nestjs/common';
import { TraktRatingsAdapter } from '../../infrastructure/adapters/trakt/trakt-ratings.adapter';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { isNull, eq } from 'drizzle-orm';

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
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
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
      const items = await this.db
        .select({
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
        })
        .from(schema.mediaItems)
        .where(eq(schema.mediaItems.id, mediaItemId))
        .limit(1);

      if (!items.length) {
        this.logger.warn(`Media item ${mediaItemId} not found for snapshot sync.`);
        return;
      }

      const item = items[0];
      let stats = null;

      // 2. Fetch stats from Trakt
      if (item.type === MediaType.MOVIE) {
        stats = await this.traktAdapter.getMovieRatingsByTmdbId(item.tmdbId);
      } else {
        stats = await this.traktAdapter.getShowRatingsByTmdbId(item.tmdbId);
      }

      if (stats) {
        // 3. Upsert snapshot
        await this.db
          .insert(schema.mediaWatchersSnapshots)
          .values({
            mediaItemId,
            snapshotDate,
            totalWatchers: stats.totalWatchers,
            region,
          })
          .onConflictDoUpdate({
            target: [
              schema.mediaWatchersSnapshots.mediaItemId,
              schema.mediaWatchersSnapshots.snapshotDate,
              schema.mediaWatchersSnapshots.region,
            ],
            set: {
              totalWatchers: stats.totalWatchers,
            },
          });
      }
    } catch (e) {
      this.logger.warn(`Failed to sync snapshot for item ${mediaItemId}: ${e.message}`);
      throw e; // Rethrow so worker can retry
    }
  }
}
