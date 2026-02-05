import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  eq,
  gte,
  gt,
  lt,
  lte,
  isNotNull,
  isNull,
  inArray,
  and,
  or,
  exists,
  sql,
  type SQL,
} from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import {
  DEFAULT_PAGE_SIZE,
  CATALOG_DEFAULT_NEW_RELEASE_DAYS,
  CATALOG_DEFAULT_DIGITAL_DAYS,
  DIGITAL_RELEASE_MAX_AGE_DAYS,
  MS_PER_DAY,
} from '@/common/constants';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  EligibilityStatus,
  EvaluationContext,
  EvaluationReason,
} from '../../../catalog-policy/public';
import {
  type CatalogSort,
  type SortOrder,
  type VoteSource,
} from '../../domain/constants/catalog-query.constants';
import {
  type MovieWithMedia,
  type WithTotal,
} from '../../domain/repositories/movie.repository.interface';

import { GenreQuery } from './shared/genre.query';
import { MovieResultMapper } from './shared/movie-result.mapper';
import { movieSelectFields, type MovieSelectRow } from './shared/movie-select.fields';

/**
 * Type of movie listing to fetch.
 */
export const MOVIE_LISTING_TYPE = {
  NOW_PLAYING: 'now_playing',
  NEW_RELEASES: 'new_releases',
  NEW_ON_DIGITAL: 'new_on_digital',
} as const;
export type MovieListingType = (typeof MOVIE_LISTING_TYPE)[keyof typeof MOVIE_LISTING_TYPE];

/**
 * Eligibility filtering mode for queries.
 * - 'catalog': Only eligible content (quality-driven surfaces)
 * - 'freshness': Eligible + ineligible with only MISSING_GLOBAL_SIGNALS
 * - 'none': No eligibility filtering (for now_playing - show everything in theaters)
 */
export const ELIGIBILITY_MODE = {
  CATALOG: 'catalog',
  FRESHNESS: 'freshness',
  NONE: 'none',
} as const;
export type EligibilityMode = (typeof ELIGIBILITY_MODE)[keyof typeof ELIGIBILITY_MODE];

/** Options for movie listings query. */
export interface MovieListingOptions {
  limit?: number;
  offset?: number;
  daysBack?: number;
  sort?: CatalogSort;
  order?: SortOrder;
  genres?: string[];
  minRatingo?: number;
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  /** Eligibility filtering mode. Defaults to 'catalog'. */
  eligibilityMode?: EligibilityMode;
}

/**
 * Fetches movie listings by type (Now Playing, New Releases, New on Digital).
 * Consolidates similar queries with type-based filtering.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class MovieListingsQuery {
  private readonly logger = new Logger(MovieListingsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly genreQuery: GenreQuery,
  ) {}

  /**
   * Executes the movie listings query.
   *
   * @param type - Type of listing (now_playing, new_releases, new_on_digital)
   * @param options - Query options
   * @returns List of movies with total count
   * @throws {DatabaseException} When database query fails
   */
  async execute(
    type: MovieListingType,
    options: MovieListingOptions = {},
  ): Promise<WithTotal<MovieWithMedia>> {
    const {
      limit = DEFAULT_PAGE_SIZE,
      offset = 0,
      eligibilityMode = ELIGIBILITY_MODE.CATALOG,
    } = options;

    try {
      const { conditions, orderBy } = this.buildQueryParams(type, options);
      const results = await this.executeQuery(conditions, orderBy, limit, offset, eligibilityMode);
      const total = await this.countTotal(conditions, eligibilityMode);
      const mediaItemIds = results.map((m) => m.mediaItemId);
      const genresMap = await this.genreQuery.fetchForMediaItems(mediaItemIds);

      const items = MovieResultMapper.mapMany(results, genresMap);
      const withTotal = items as WithTotal<MovieWithMedia>;
      withTotal.total = total;
      return withTotal;
    } catch (error) {
      this.logger.error(`Failed to find ${type} movies: ${error.message}`, error.stack);
      throw new DatabaseException(`Failed to fetch ${type} movies`, {
        originalError: error.message,
      });
    }
  }

  /**
   * Builds query conditions and order based on listing type and options.
   */
  private buildQueryParams(type: MovieListingType, options: MovieListingOptions) {
    const {
      sort = 'popularity',
      order = 'desc',
      eligibilityMode = ELIGIBILITY_MODE.CATALOG,
    } = options;

    const conditions: SQL[] = [
      ...this.buildCommonConditions(eligibilityMode),
      ...this.buildTypeConditions(type, options.daysBack),
      ...this.buildFilterConditions(options),
    ];

    return { conditions, orderBy: this.buildOrder(sort, order) };
  }

  /**
   * Builds common conditions: READY status, not deleted, eligibility.
   */
  private buildCommonConditions(eligibilityMode: EligibilityMode): SQL[] {
    const conditions: SQL[] = [
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
    ];

    const eligibilityCondition = this.buildEligibilityCondition(eligibilityMode);
    if (eligibilityCondition) {
      conditions.push(eligibilityCondition);
    }

    return conditions;
  }

  /**
   * Builds type-specific conditions for now_playing, new_releases, new_on_digital.
   */
  private buildTypeConditions(type: MovieListingType, daysBack?: number): SQL[] {
    const now = new Date();

    switch (type) {
      case MOVIE_LISTING_TYPE.NOW_PLAYING:
        return [
          eq(schema.movies.isNowPlaying, true),
          or(isNull(schema.movies.digitalReleaseDate), gt(schema.movies.digitalReleaseDate, now)),
        ];

      case MOVIE_LISTING_TYPE.NEW_RELEASES: {
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - (daysBack ?? CATALOG_DEFAULT_NEW_RELEASE_DAYS));
        return [
          isNotNull(schema.movies.theatricalReleaseDate),
          gte(schema.movies.theatricalReleaseDate, cutoffDate),
          lte(schema.movies.theatricalReleaseDate, now),
          or(isNull(schema.movies.digitalReleaseDate), gt(schema.movies.digitalReleaseDate, now)),
        ];
      }

      case MOVIE_LISTING_TYPE.NEW_ON_DIGITAL: {
        const cutoffDate = new Date(
          now.getTime() - (daysBack ?? CATALOG_DEFAULT_DIGITAL_DAYS) * MS_PER_DAY,
        );
        const originalReleaseCutoff = new Date(
          now.getTime() - DIGITAL_RELEASE_MAX_AGE_DAYS * MS_PER_DAY,
        );
        return [
          isNotNull(schema.movies.digitalReleaseDate),
          gte(schema.movies.digitalReleaseDate, cutoffDate),
          lte(schema.movies.digitalReleaseDate, now),
          isNotNull(schema.mediaItems.releaseDate),
          gte(schema.mediaItems.releaseDate, originalReleaseCutoff),
        ];
      }
    }
  }

  /**
   * Builds filter conditions: genre, year, minRatingo, minVotes.
   */
  private buildFilterConditions(options: MovieListingOptions): SQL[] {
    const { genres, minRatingo, voteSource = 'tmdb', minVotes, year, yearFrom, yearTo } = options;
    const conditions: SQL[] = [];

    conditions.push(...this.buildYearConditions(year, yearFrom, yearTo));

    if (minRatingo !== undefined) {
      conditions.push(gte(schema.mediaStats.ratingoScore, minRatingo));
    }

    if (minVotes !== undefined) {
      const voteColumn =
        voteSource === 'trakt' ? schema.mediaItems.voteCountTrakt : schema.mediaItems.voteCount;
      conditions.push(gte(voteColumn, minVotes));
    }

    if (genres && genres.length) {
      conditions.push(this.buildGenreCondition(genres));
    }

    return conditions;
  }

  /**
   * Builds year filter conditions.
   * Uses exclusive end boundary (lt) to avoid including next year's first day.
   */
  private buildYearConditions(year?: number, yearFrom?: number, yearTo?: number): SQL[] {
    const conditions: SQL[] = [];

    if (year !== undefined) {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      conditions.push(
        isNotNull(schema.mediaItems.releaseDate),
        gte(schema.mediaItems.releaseDate, start),
        lt(schema.mediaItems.releaseDate, end),
      );
    } else if (yearFrom !== undefined || yearTo !== undefined) {
      conditions.push(isNotNull(schema.mediaItems.releaseDate));
      if (yearFrom !== undefined) {
        const start = new Date(Date.UTC(yearFrom, 0, 1));
        conditions.push(gte(schema.mediaItems.releaseDate, start));
      }
      if (yearTo !== undefined) {
        const end = new Date(Date.UTC(yearTo + 1, 0, 1));
        conditions.push(lt(schema.mediaItems.releaseDate, end));
      }
    }

    return conditions;
  }

  /**
   * Builds genre filter as EXISTS subquery.
   */
  private buildGenreCondition(genres: string[]): SQL {
    return exists(
      this.db
        .select({ id: schema.mediaGenres.id })
        .from(schema.mediaGenres)
        .innerJoin(schema.genres, eq(schema.mediaGenres.genreId, schema.genres.id))
        .where(
          and(
            eq(schema.mediaGenres.mediaItemId, schema.mediaItems.id),
            inArray(schema.genres.slug, genres),
          ),
        ),
    );
  }

  /**
   * Builds eligibility condition based on mode.
   */
  private buildEligibilityCondition(eligibilityMode: EligibilityMode): SQL | null {
    if (eligibilityMode === ELIGIBILITY_MODE.NONE) {
      return null;
    }

    if (eligibilityMode === ELIGIBILITY_MODE.FRESHNESS) {
      return or(
        eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
        and(
          eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.INELIGIBLE),
          sql`${schema.mediaCatalogEvaluations.reasons} = ARRAY[${EvaluationReason.MISSING_GLOBAL_SIGNALS}]::text[]`,
        ),
      );
    }

    return eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE);
  }

  /**
   * Executes query with appropriate joins based on eligibility mode.
   */
  private async executeQuery(
    conditions: SQL[],
    orderBy: SQL[],
    limit: number,
    offset: number,
    eligibilityMode: EligibilityMode,
  ): Promise<MovieSelectRow[]> {
    if (eligibilityMode === ELIGIBILITY_MODE.NONE) {
      return this.db
        .select(movieSelectFields)
        .from(schema.movies)
        .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);
    }

    return this.db
      .select(movieSelectFields)
      .from(schema.movies)
      .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
      .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
      .innerJoin(
        schema.mediaCatalogEvaluations,
        and(
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
          eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);
  }

  private buildOrder(sort: CatalogSort, order: SortOrder): SQL[] {
    const dir = order === 'asc' ? sql`asc` : sql`desc`;
    const nullsLast = sql`NULLS LAST`;

    if (sort === 'ratingo') {
      return [sql`${schema.mediaStats.ratingoScore} ${dir}`, sql`${schema.mediaItems.id} desc`];
    }
    if (sort === 'releaseDate') {
      return [
        sql`${schema.mediaItems.releaseDate} ${dir} ${nullsLast}`,
        sql`${schema.mediaItems.id} desc`,
      ];
    }
    if (sort === 'tmdbPopularity') {
      return [sql`${schema.mediaItems.popularity} ${dir}`, sql`${schema.mediaItems.id} desc`];
    }
    return [sql`${schema.mediaStats.popularityScore} ${dir}`, sql`${schema.mediaItems.id} desc`];
  }

  /**
   * Counts total matching records with appropriate joins.
   */
  private async countTotal(
    conditions: SQL[],
    eligibilityMode: EligibilityMode = ELIGIBILITY_MODE.CATALOG,
  ): Promise<number> {
    if (eligibilityMode === ELIGIBILITY_MODE.NONE) {
      const [{ total }] = await this.db
        .select({ total: sql<number>`count(*)` })
        .from(schema.movies)
        .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...conditions));
      return Number(total ?? 0);
    }

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(schema.movies)
      .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
      .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
      .innerJoin(
        schema.mediaCatalogEvaluations,
        and(
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
          eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(and(...conditions));
    return Number(total ?? 0);
  }
}
