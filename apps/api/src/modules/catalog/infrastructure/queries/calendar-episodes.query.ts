import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, gt, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { type PgColumn } from 'drizzle-orm/pg-core';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import {
  type CalendarEpisode,
  type CalendarEpisodesOptions,
} from '@/modules/catalog/domain/repositories/show.repository.interface';
import { EvaluationContext } from '@/modules/catalog-policy/public';
import { SAVED_ITEM_LIST } from '@/modules/user-actions/public';
import { USER_MEDIA_STATE } from '@/modules/user-media/public';

import { eligibleUnderActivePolicy } from './shared/movie-release-conditions';

const PREMIERE_EPISODE_NUMBER = 1;
const SPECIALS_SEASON_NUMBER = 0;
const CALENDAR_ELIGIBILITY_CONTEXTS = [EvaluationContext.CATALOG, EvaluationContext.UPCOMING];

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
const isAirDateDayOnly = sql<boolean>`coalesce(${episodes.airDateDayOnly}, false)`;
const byPopularityDescNullsLast = sql`${mediaItems.popularity} desc nulls last`;

function ownedByViewer(column: PgColumn, viewerId: string | undefined): SQL {
  return viewerId ? eq(column, viewerId) : sql`false`;
}

function isSeasonPremiere(): SQL | undefined {
  return and(
    eq(episodes.number, PREMIERE_EPISODE_NUMBER),
    gt(seasons.number, SPECIALS_SEASON_NUMBER),
  );
}

function isSavedPremiere(): SQL | undefined {
  return and(isSaved, isSeasonPremiere());
}

function episodeFilter(
  startDate: Date,
  endDate: Date,
  options: CalendarEpisodesOptions,
): SQL | undefined {
  return and(
    gte(episodes.airDate, startDate),
    lte(episodes.airDate, endDate),
    eq(mediaItems.ingestionStatus, IngestionStatus.READY),
    isNull(mediaItems.deletedAt),
    eligibleUnderActivePolicy(CALENDAR_ELIGIBILITY_CONTEXTS),
    options.personalized ? or(isTracked, isSavedPremiere()) : undefined,
    options.premieresOnly ? isSeasonPremiere() : undefined,
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
    airDateDayOnly: Boolean(row.airDateDayOnly),
  };
}

/**
 * Fetches episodes airing within a date range for calendar view.
 *
 * Only includes shows that are ELIGIBLE under the active policy in the catalog
 * or upcoming context, filtering out content irrelevant to the target audience
 * (e.g. CJK-only, blocked languages/countries).
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
   * @param {CalendarEpisodesOptions} [options] - Viewer state, personalized and premieres filtering
   * @returns {Promise<CalendarEpisode[]>} Episodes airing in the date range
   * @throws {DatabaseException} When database query fails
   */
  execute(
    startDate: Date,
    endDate: Date,
    options: CalendarEpisodesOptions = {},
  ): Promise<CalendarEpisode[]> {
    const { viewerId } = options;

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
          airDateDayOnly: isAirDateDayOnly,
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
        .where(episodeFilter(startDate, endDate, options))
        .orderBy(asc(episodes.airDate), byPopularityDescNullsLast, asc(episodes.id));

      return rows.map(toCalendarEpisode);
    });
  }
}
