import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, gt, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import { type PgColumn } from 'drizzle-orm/pg-core';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import {
  type CalendarEpisode,
  type CalendarEpisodesOptions,
} from '@/modules/catalog/domain/repositories/show.repository.interface';
import { EligibilityStatus, EvaluationContext } from '@/modules/catalog-policy/public';
import { SAVED_ITEM_LIST } from '@/modules/user-actions/public';
import { USER_MEDIA_STATE } from '@/modules/user-media/public';

const PREMIERE_EPISODE_NUMBER = 1;
const SPECIALS_SEASON_NUMBER = 0;

const {
  episodes,
  seasons,
  shows,
  mediaItems,
  userMediaState,
  userSavedItems,
  userEpisodeProgress,
} = schema;

const isTracked = sql<boolean>`coalesce(${userMediaState.state} = ${USER_MEDIA_STATE.WATCHING}, false)`;
const isSaved = sql<boolean>`${userSavedItems.id} is not null`;
const isWatched = sql<boolean>`${userEpisodeProgress.episodeId} is not null`;
const byPopularityDescNullsLast = sql`${mediaItems.popularity} desc nulls last`;

function ownedByViewer(column: PgColumn, viewerId: string | undefined): SQL {
  return viewerId ? eq(column, viewerId) : sql`false`;
}

function isSavedPremiere(): SQL | undefined {
  return and(
    isSaved,
    eq(episodes.number, PREMIERE_EPISODE_NUMBER),
    gt(seasons.number, SPECIALS_SEASON_NUMBER),
  );
}

function knownEpisodeCount(count: number | null): number | null {
  return count !== null && count > 0 ? count : null;
}

interface CalendarEpisodeRow extends Omit<CalendarEpisode, 'airDate' | 'showPopularity'> {
  airDate: Date | null;
  showPopularity: number | null;
}

function toCalendarEpisode(row: CalendarEpisodeRow): CalendarEpisode {
  return {
    ...row,
    airDate: row.airDate!,
    showPopularity: row.showPopularity ?? 0,
    seasonEpisodeCount: knownEpisodeCount(row.seasonEpisodeCount),
    isTracked: Boolean(row.isTracked),
    isSaved: Boolean(row.isSaved),
    isWatched: Boolean(row.isWatched),
  };
}

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
   * @param {CalendarEpisodesOptions} [options] - Viewer state and personalized filtering
   * @returns {Promise<CalendarEpisode[]>} Episodes airing in the date range
   * @throws {DatabaseException} When database query fails
   */
  execute(
    startDate: Date,
    endDate: Date,
    options: CalendarEpisodesOptions = {},
  ): Promise<CalendarEpisode[]> {
    const { viewerId } = options;
    const inRange = and(gte(episodes.airDate, startDate), lte(episodes.airDate, endDate));
    const where = options.personalized ? and(inRange, or(isTracked, isSavedPremiere())) : inRange;

    return withDbError('fetch calendar episodes', this.logger, async () => {
      const rows = await this.db
        .select({
          episodeId: episodes.id,
          showId: shows.mediaItemId,
          showRecordId: shows.id,
          showSlug: mediaItems.slug,
          showTitle: mediaItems.title,
          posterPath: mediaItems.posterPath,
          showPopularity: mediaItems.popularity,
          seasonNumber: seasons.number,
          seasonEpisodeCount: seasons.episodeCount,
          episodeNumber: episodes.number,
          title: episodes.title,
          overview: episodes.overview,
          airDate: episodes.airDate,
          runtime: episodes.runtime,
          stillPath: episodes.stillPath,
          isTracked,
          isSaved,
          isWatched,
        })
        .from(episodes)
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .innerJoin(shows, eq(episodes.showId, shows.id))
        .innerJoin(mediaItems, eq(shows.mediaItemId, mediaItems.id))
        .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
        .innerJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaCatalogEvaluations.mediaItemId, mediaItems.id),
            eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
            eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
            eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
          ),
        )
        .leftJoin(
          userMediaState,
          and(
            eq(userMediaState.mediaItemId, mediaItems.id),
            ownedByViewer(userMediaState.userId, viewerId),
          ),
        )
        .leftJoin(
          userSavedItems,
          and(
            eq(userSavedItems.mediaItemId, mediaItems.id),
            eq(userSavedItems.list, SAVED_ITEM_LIST.FOR_LATER),
            ownedByViewer(userSavedItems.userId, viewerId),
          ),
        )
        .leftJoin(
          userEpisodeProgress,
          and(
            eq(userEpisodeProgress.episodeId, episodes.id),
            ownedByViewer(userEpisodeProgress.userId, viewerId),
          ),
        )
        .where(where)
        .orderBy(asc(episodes.airDate), byPopularityDescNullsLast, asc(episodes.id));

      return rows.map(toCalendarEpisode);
    });
  }
}
