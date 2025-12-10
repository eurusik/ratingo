import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { CalendarEpisode } from '../../domain/repositories/show.repository.interface';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

/**
 * Fetches episodes airing within a date range for calendar view.
 *
 * Joins episodes with seasons, shows, and media items to provide
 * complete episode information for the global release calendar.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class CalendarEpisodesQuery {
  private readonly logger = new Logger(CalendarEpisodesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the calendar episodes query.
   *
   * @param {Date} startDate - Start of date range (inclusive)
   * @param {Date} endDate - End of date range (inclusive)
   * @returns {Promise<CalendarEpisode[]>} Episodes airing in the date range
   * @throws {DatabaseException} When database query fails
   */
  async execute(startDate: Date, endDate: Date): Promise<CalendarEpisode[]> {
    try {
      const results = await this.db
        .select({
          showId: schema.shows.mediaItemId,
          showTitle: schema.mediaItems.title,
          posterPath: schema.mediaItems.posterPath,
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
          title: schema.episodes.title,
          overview: schema.episodes.overview,
          airDate: schema.episodes.airDate,
          runtime: schema.episodes.runtime,
          stillPath: schema.episodes.stillPath,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
        .innerJoin(schema.shows, eq(schema.episodes.showId, schema.shows.id))
        .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
        .where(
          and(
            gte(schema.episodes.airDate, startDate),
            lte(schema.episodes.airDate, endDate)
          )
        )
        .orderBy(asc(schema.episodes.airDate));

      return results.map(row => ({
        showId: row.showId,
        showTitle: row.showTitle,
        posterPath: row.posterPath,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        title: row.title,
        overview: row.overview,
        airDate: row.airDate!,
        runtime: row.runtime,
        stillPath: row.stillPath,
      }));
    } catch (error) {
      this.logger.error(`Failed to find episodes by date range: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch calendar episodes', { originalError: error.message });
    }
  }
}
