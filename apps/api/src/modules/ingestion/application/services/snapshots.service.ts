import { Injectable, Logger, Inject } from '@nestjs/common';
import { TraktAdapter } from '../../infrastructure/adapters/trakt/trakt.adapter';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { isNull } from 'drizzle-orm';

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(
    private readonly traktAdapter: TraktAdapter,
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Syncs daily watchers snapshots for all media items.
   * Intended to be run once a day by a cron job.
   */
  async syncDailySnapshots() {
    this.logger.log('Starting daily snapshots sync...');

    // Fetch all active media items
    // TODO: In the future, filter by status or popularity to save API calls
    const items = await this.db
      .select({
        id: schema.mediaItems.id,
        tmdbId: schema.mediaItems.tmdbId,
        type: schema.mediaItems.type,
      })
      .from(schema.mediaItems)
      .where(isNull(schema.mediaItems.deletedAt));

    this.logger.log(`Found ${items.length} items to sync.`);

    // Normalize date to start of day to ensure unique constraint works per day
    const snapshotDate = new Date();
    snapshotDate.setUTCHours(0, 0, 0, 0);

    let processed = 0;
    let updated = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            let stats = null;
            if (item.type === MediaType.MOVIE) {
              stats = await this.traktAdapter.getMovieRatingsByTmdbId(item.tmdbId);
            } else {
              stats = await this.traktAdapter.getShowRatingsByTmdbId(item.tmdbId);
            }

            if (stats) {
              // Insert or update snapshot for today
              await this.db
                .insert(schema.mediaWatchersSnapshots)
                .values({
                  mediaItemId: item.id,
                  snapshotDate: snapshotDate,
                  totalWatchers: stats.totalWatchers,
                  region: 'global',
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
              updated++;
            }
          } catch (e) {
            this.logger.warn(`Failed to sync snapshot for item ${item.id} (TMDB ${item.tmdbId}): ${e.message} \nFull Error: ${JSON.stringify(e)}`);
          }
        })
      );

      processed += batch.length;
      if (processed % 50 === 0) {
        this.logger.log(`Processed ${processed}/${items.length} items...`);
      }
    }

    this.logger.log(`Daily snapshots sync complete. Updated ${updated} snapshots.`);
  }
}
