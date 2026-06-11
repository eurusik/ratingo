import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import { USER_MEDIA_STATE } from '../../../user-media/public';
import { type CalendarEpisode } from '../../domain/repositories/show.repository.interface';

/**
 * Fetches episodes airing within a date range for calendar view.
 *
 * Only includes shows that are ELIGIBLE under the active catalog policy,
 * filtering out content irrelevant to the target audience (e.g. CJK-only,
 * blocked languages/countries).
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
   * @param {string | null} [userId] - When provided, filters to shows the user is currently watching
   * @returns {Promise<CalendarEpisode[]>} Episodes airing in the date range
   * @throws {DatabaseException} When database query fails
   */
  async execute(
    startDate: Date,
    endDate: Date,
    userId?: string | null,
  ): Promise<CalendarEpisode[]> {
    try {
      const baseQuery = this.db
        .select({
          showId: schema.shows.mediaItemId,
          showSlug: schema.mediaItems.slug,
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
        .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
        .innerJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaCatalogEvaluations.mediaItemId, schema.mediaItems.id),
            eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
            eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
            eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
          ),
        );

      const withUserFilter = userId
        ? baseQuery.innerJoin(
            schema.userMediaState,
            and(
              eq(schema.userMediaState.mediaItemId, schema.mediaItems.id),
              eq(schema.userMediaState.userId, userId),
              eq(schema.userMediaState.state, USER_MEDIA_STATE.WATCHING),
            ),
          )
        : baseQuery;

      const results = await withUserFilter
        .where(and(gte(schema.episodes.airDate, startDate), lte(schema.episodes.airDate, endDate)))
        .orderBy(asc(schema.episodes.airDate));

      return results.map((row) => ({
        showId: row.showId,
        showSlug: row.showSlug,
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
      throw new DatabaseException('Failed to fetch calendar episodes', {
        originalError: error.message,
      });
    }
  }
}
