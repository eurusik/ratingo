import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, inArray } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type MediaScoreData,
  type MediaScoreDataWithTmdbId,
} from '../../domain/repositories/media.repository.interface';

/**
 * Fetches media data required for score calculation.
 *
 * Provides single-item and batch lookups that join media items with show
 * details and stats to assemble the inputs used by the Score Calculator.
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class MediaScoringQuery {
  private readonly logger = new Logger(MediaScoringQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Retrieves media data needed for score calculation for a single item.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findById(id: string): Promise<MediaScoreData | null> {
    return withDbError(
      'find media for scoring',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            id: schema.mediaItems.id,
            popularity: schema.mediaItems.popularity,
            releaseDate: schema.mediaItems.releaseDate,
            lastAirDate: schema.shows.lastAirDate,
            ratingImdb: schema.mediaItems.ratingImdb,
            ratingTrakt: schema.mediaItems.ratingTrakt,
            ratingMetacritic: schema.mediaItems.ratingMetacritic,
            ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
            voteCountImdb: schema.mediaItems.voteCountImdb,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
            watchersCount: schema.mediaStats.watchersCount,
            totalWatchers: schema.mediaStats.totalWatchers,
          })
          .from(schema.mediaItems)
          .leftJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(eq(schema.mediaItems.id, id))
          .limit(1);

        return result[0] || null;
      },
      { id },
    );
  }

  /**
   * Batch: Retrieves score data for multiple media items in a single query.
   *
   * @throws {DatabaseException} If database query fails
   */
  async findMany(ids: string[]): Promise<MediaScoreDataWithTmdbId[]> {
    if (ids.length === 0) return [];

    return withDbError(
      'find media for batch scoring',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            popularity: schema.mediaItems.popularity,
            releaseDate: schema.mediaItems.releaseDate,
            lastAirDate: schema.shows.lastAirDate,
            ratingImdb: schema.mediaItems.ratingImdb,
            ratingTrakt: schema.mediaItems.ratingTrakt,
            ratingMetacritic: schema.mediaItems.ratingMetacritic,
            ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
            voteCountImdb: schema.mediaItems.voteCountImdb,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
            watchersCount: schema.mediaStats.watchersCount,
            totalWatchers: schema.mediaStats.totalWatchers,
          })
          .from(schema.mediaItems)
          .leftJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(inArray(schema.mediaItems.id, ids));

        return result as MediaScoreDataWithTmdbId[];
      },
      { count: ids.length },
    );
  }
}
