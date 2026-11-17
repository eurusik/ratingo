import { Inject, Injectable, Logger } from '@nestjs/common';

import { type AnyColumn, and, asc, eq, exists, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { type PgTable } from 'drizzle-orm/pg-core';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { ImageMapper } from '@/common/mappers/image.mapper';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { effectiveMovieReleaseDate } from '@/database/movie-release-conditions';
import * as schema from '@/database/schema';
import type {
  CalendarMovie,
  CalendarMovieReleases,
  CalendarMoviesOptions,
  ReleaseDateRange,
} from '@/modules/catalog/domain/repositories/movie.repository.interface';
import {
  type MovieReleaseEntry,
  resolveMovieRelease,
} from '@/modules/catalog/domain/utils/movie-release.utils';
import { EvaluationContext } from '@/modules/catalog-policy/public';
import { SAVED_ITEM_LIST, SUBSCRIPTION_TRIGGER } from '@/modules/user-actions/public';
import { USER_MEDIA_STATE } from '@/modules/user-media/public';

import {
  effectiveReleaseWithin,
  eligibleUnderActivePolicy,
} from './shared/movie-release-conditions';

const { movies, mediaItems, userMediaState, userSavedItems, userSubscriptions } = schema;

const CALENDAR_ELIGIBILITY_CONTEXTS = [EvaluationContext.UPCOMING, EvaluationContext.CATALOG];

const NO_VIEWER_MATCH = sql<boolean>`false`;

type MediaItemIdRef = AnyColumn | SQL;

interface CalendarMovieRow {
  mediaItemId: string;
  tmdbId: number;
  slug: string;
  title: string;
  posterPath: string | null;
  popularity: number | null;
  releaseDate: Date | null;
  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  releases: MovieReleaseEntry[] | null;
  isSavedForLater: boolean;
  isReminderSet: boolean;
  releaseDay: string;
  dayCount: number | string;
}

@Injectable()
export class CalendarMoviesQuery {
  private readonly logger = new Logger(CalendarMoviesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  execute(
    range: ReleaseDateRange,
    options: CalendarMoviesOptions = {},
  ): Promise<CalendarMovieReleases> {
    return withDbError('fetch calendar movies', this.logger, async () => {
      const rows: CalendarMovieRow[] = await this.select(range, options);
      return {
        movies: rows.map(toCalendarMovie).filter(isCalendarMovie),
        movieCountByDay: countByDay(rows),
      };
    });
  }

  select(range: ReleaseDateRange, options: CalendarMoviesOptions = {}) {
    const { viewerId, perDayLimit } = options;
    const ranked = this.rankReleasesByDay(range, audienceOf(options)).as('ranked');

    return this.db
      .select({
        mediaItemId: ranked.mediaItemId,
        tmdbId: ranked.tmdbId,
        slug: ranked.slug,
        title: ranked.title,
        posterPath: ranked.posterPath,
        popularity: ranked.popularity,
        releaseDate: ranked.releaseDate,
        theatricalReleaseDate: ranked.theatricalReleaseDate,
        digitalReleaseDate: ranked.digitalReleaseDate,
        releases: ranked.releases,
        releaseDay: ranked.releaseDay,
        dayCount: ranked.dayCount,
        isSavedForLater: viewerId ? isSavedForLater(viewerId, ranked.mediaItemId) : NO_VIEWER_MATCH,
        isReminderSet: viewerId ? isReminderSet(viewerId, ranked.mediaItemId) : NO_VIEWER_MATCH,
      })
      .from(ranked)
      .where(perDayLimit ? lte(ranked.dayRank, perDayLimit) : undefined)
      .orderBy(asc(ranked.releaseDay), asc(ranked.dayRank));
  }

  private rankReleasesByDay(range: ReleaseDateRange, audience: SQL | undefined) {
    const releaseDay = sql<string>`to_char(${effectiveMovieReleaseDate()}, 'YYYY-MM-DD')`;

    return this.db
      .select({
        mediaItemId: mediaItems.id,
        tmdbId: mediaItems.tmdbId,
        slug: mediaItems.slug,
        title: mediaItems.title,
        posterPath: mediaItems.posterPath,
        popularity: mediaItems.popularity,
        releaseDate: mediaItems.releaseDate,
        theatricalReleaseDate: movies.theatricalReleaseDate,
        digitalReleaseDate: movies.digitalReleaseDate,
        releases: movies.releases,
        releaseDay: releaseDay.as('release_day'),
        dayRank:
          sql<number>`row_number() over (partition by ${releaseDay} order by ${mediaItems.popularity} desc nulls last, ${mediaItems.id})`.as(
            'day_rank',
          ),
        dayCount: sql<number>`count(*) over (partition by ${releaseDay})`.as('day_count'),
      })
      .from(movies)
      .innerJoin(mediaItems, eq(movies.mediaItemId, mediaItems.id))
      .where(
        and(
          eq(mediaItems.ingestionStatus, IngestionStatus.READY),
          isNull(mediaItems.deletedAt),
          effectiveReleaseWithin(range),
          audience,
        ),
      );
  }
}

function audienceOf({ viewerId, personalized }: CalendarMoviesOptions): SQL | undefined {
  if (personalized && viewerId) {
    return or(isSavedForLater(viewerId, mediaItems.id), isReminderSet(viewerId, mediaItems.id));
  }
  if (personalized) return NO_VIEWER_MATCH;
  return eligibleUnderActivePolicy(CALENDAR_ELIGIBILITY_CONTEXTS);
}

function rowExists(table: PgTable, conditions: SQL | undefined): SQL<boolean> {
  return sql<boolean>`${exists(sql`(select 1 from ${table} where ${conditions})`)}`;
}

function isSavedForLater(viewerId: string, mediaItemId: MediaItemIdRef): SQL<boolean> {
  return sql<boolean>`(${or(
    rowExists(
      userMediaState,
      and(
        eq(userMediaState.userId, viewerId),
        sql`${userMediaState.mediaItemId} = ${mediaItemId}`,
        eq(userMediaState.state, USER_MEDIA_STATE.PLANNED),
      ),
    ),
    rowExists(
      userSavedItems,
      and(
        eq(userSavedItems.userId, viewerId),
        sql`${userSavedItems.mediaItemId} = ${mediaItemId}`,
        eq(userSavedItems.list, SAVED_ITEM_LIST.FOR_LATER),
      ),
    ),
  )})`;
}

function isReminderSet(viewerId: string, mediaItemId: MediaItemIdRef): SQL<boolean> {
  return rowExists(
    userSubscriptions,
    and(
      eq(userSubscriptions.userId, viewerId),
      sql`${userSubscriptions.mediaItemId} = ${mediaItemId}`,
      eq(userSubscriptions.trigger, SUBSCRIPTION_TRIGGER.RELEASE),
      eq(userSubscriptions.isActive, true),
    ),
  );
}

function toCalendarMovie(row: CalendarMovieRow): CalendarMovie | null {
  const release = resolveMovieRelease(row, row.releases);
  if (!release) return null;
  return {
    mediaItemId: row.mediaItemId,
    tmdbId: row.tmdbId,
    slug: row.slug,
    title: row.title,
    poster: ImageMapper.toPoster(row.posterPath),
    releaseDate: release.date,
    releaseDateKind: release.kind,
    releaseCountry: release.country,
    popularity: row.popularity ?? 0,
    isSavedForLater: Boolean(row.isSavedForLater),
    isReminderSet: Boolean(row.isReminderSet),
  };
}

function isCalendarMovie(movie: CalendarMovie | null): movie is CalendarMovie {
  return movie !== null;
}

function countByDay(rows: CalendarMovieRow[]): ReadonlyMap<string, number> {
  return new Map(rows.map((row) => [row.releaseDay, Number(row.dayCount)]));
}
