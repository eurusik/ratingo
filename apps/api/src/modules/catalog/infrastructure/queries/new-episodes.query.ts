import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

/**
 * New episode item for the update feed.
 * Grouped by show - one entry per show with the latest episode.
 */
export interface NewEpisodeItem {
  showId: string;
  slug: string;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  airDate: Date;
}

/**
 * Fetches shows with new episodes within a date range.
 * Groups by show and returns only the latest episode per show.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class NewEpisodesQuery {
  private readonly logger = new Logger(NewEpisodesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the new episodes query.
   *
   * @param {number} days - Number of days to look back (default: 7)
   * @param {number} limit - Max number of shows to return (default: 20)
   * @returns {Promise<NewEpisodeItem[]>} Shows with new episodes
   * @throws {DatabaseException} When database query fails
   */
  async execute(days: number = 7, limit: number = 20): Promise<NewEpisodeItem[]> {
    try {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);

      const results = await this.db
        .select({
          showId: schema.shows.mediaItemId,
          slug: schema.mediaItems.slug,
          title: schema.mediaItems.title,
          posterPath: schema.mediaItems.posterPath,
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
          episodeTitle: schema.episodes.title,
          airDate: schema.episodes.airDate,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
        .innerJoin(schema.shows, eq(schema.episodes.showId, schema.shows.id))
        .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
        .where(and(gte(schema.episodes.airDate, startDate), lte(schema.episodes.airDate, now)))
        .orderBy(desc(schema.episodes.airDate))
        .limit(limit * 3);

      const showMap = new Map<string, NewEpisodeItem>();

      for (const row of results) {
        if (!row.airDate) continue;

        if (!showMap.has(row.showId)) {
          showMap.set(row.showId, {
            showId: row.showId,
            slug: row.slug,
            title: row.title,
            posterPath: row.posterPath,
            seasonNumber: row.seasonNumber,
            episodeNumber: row.episodeNumber,
            episodeTitle: row.episodeTitle ?? '',
            airDate: row.airDate,
          });
        }

        if (showMap.size >= limit) break;
      }

      return Array.from(showMap.values());
    } catch (error) {
      this.logger.error(`Failed to fetch new episodes: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch new episodes', {
        originalError: error.message,
      });
    }
  }
}
