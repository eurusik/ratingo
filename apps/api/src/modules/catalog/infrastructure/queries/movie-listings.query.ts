import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, gte, gt, lte, isNotNull, isNull, inArray, and, or, exists, sql } from 'drizzle-orm';
import { MovieWithMedia, WithTotal } from '../../domain/repositories/movie.repository.interface';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { CatalogSort, SortOrder, VoteSource } from '../../presentation/dtos/catalog-list-query.dto';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { EligibilityStatus } from '../../../catalog-policy/domain/constants/evaluation.constants';
import { GenreQuery } from './shared/genre.query';
import { movieSelectFields, MovieSelectRow } from './shared/movie-select.fields';
import { MovieResultMapper } from './shared/movie-result.mapper';

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
      limit = 20,
      offset = 0,
      daysBack,
      sort = 'popularity',
      order = 'desc',
      genres,
      minRatingo,
      voteSource = 'tmdb',
      minVotes,
      year,
      yearFrom,
      yearTo,
      eligibilityMode = ELIGIBILITY_MODE.CATALOG,
    } = options;

    try {
      const { conditions, orderBy } = this.buildQueryParams(
        type,
        daysBack,
        sort,
        order,
        genres,
        minRatingo,
        voteSource,
        minVotes,
        year,
        yearFrom,
        yearTo,
        eligibilityMode,
      );

      let results: any[];

      if (eligibilityMode === ELIGIBILITY_MODE.NONE) {
        results = await this.db
          .select(movieSelectFields)
          .from(schema.movies)
          .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
          .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
          .where(and(...conditions))
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset);
      } else {
        results = await this.db
          .select(movieSelectFields)
          .from(schema.movies)
          .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
          .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
          .innerJoin(
            schema.mediaCatalogEvaluations,
            and(
              eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
              eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
            ),
          )
          .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
          .where(and(...conditions))
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset);
      }

      const total = await this.countTotal(conditions, eligibilityMode);
      const mediaItemIds = results.map((m) => m.mediaItemId);
      const genresMap = await this.genreQuery.fetchForMediaItems(mediaItemIds);

      const items = MovieResultMapper.mapMany(results as MovieSelectRow[], genresMap);
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

  /** Builds query conditions and order based on listing type. */
  private buildQueryParams(
    type: MovieListingType,
    daysBack: number | undefined,
    sort: CatalogSort,
    order: SortOrder,
    genres?: string[],
    minRatingo?: number,
    voteSource?: VoteSource,
    minVotes?: number,
    year?: number,
    yearFrom?: number,
    yearTo?: number,
    eligibilityMode: EligibilityMode = 'catalog',
  ) {
    const now = new Date();
    const conditions: any[] = [
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
    ];

    const eligibilityCondition = this.buildEligibilityCondition(eligibilityMode);
    if (eligibilityCondition) {
      conditions.push(eligibilityCondition);
    }

    // Release date filters
    if (year !== undefined) {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      conditions.push(
        isNotNull(schema.mediaItems.releaseDate),
        gte(schema.mediaItems.releaseDate, start),
        lte(schema.mediaItems.releaseDate, end),
      );
    } else if (yearFrom !== undefined || yearTo !== undefined) {
      if (yearFrom !== undefined) {
        const start = new Date(Date.UTC(yearFrom, 0, 1));
        conditions.push(
          isNotNull(schema.mediaItems.releaseDate),
          gte(schema.mediaItems.releaseDate, start),
        );
      }
      if (yearTo !== undefined) {
        const end = new Date(Date.UTC(yearTo + 1, 0, 1));
        conditions.push(
          isNotNull(schema.mediaItems.releaseDate),
          lte(schema.mediaItems.releaseDate, end),
        );
      }
    }

    if (minRatingo !== undefined) {
      conditions.push(gte(schema.mediaStats.ratingoScore, minRatingo));
    }

    if (minVotes !== undefined) {
      if (voteSource === 'trakt') {
        conditions.push(gte(schema.mediaItems.voteCountTrakt, minVotes));
      } else {
        conditions.push(gte(schema.mediaItems.voteCount, minVotes));
      }
    }

    if (genres && genres.length) {
      conditions.push(
        exists(
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
        ),
      );
    }

    switch (type) {
      case 'now_playing':
        conditions.push(
          eq(schema.movies.isNowPlaying, true),
          or(isNull(schema.movies.digitalReleaseDate), gt(schema.movies.digitalReleaseDate, now)),
        );
        return { conditions, orderBy: this.buildOrder(sort, order) };

      case 'new_releases': {
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - (daysBack ?? 30));
        conditions.push(
          isNotNull(schema.movies.theatricalReleaseDate),
          gte(schema.movies.theatricalReleaseDate, cutoffDate),
          lte(schema.movies.theatricalReleaseDate, now),
          or(isNull(schema.movies.digitalReleaseDate), gt(schema.movies.digitalReleaseDate, now)),
        );
        return { conditions, orderBy: this.buildOrder(sort, order) };
      }

      case 'new_on_digital': {
        const cutoffDate = new Date(now.getTime() - (daysBack ?? 14) * 24 * 60 * 60 * 1000);
        conditions.push(
          isNotNull(schema.movies.digitalReleaseDate),
          gte(schema.movies.digitalReleaseDate, cutoffDate),
          lte(schema.movies.digitalReleaseDate, now),
        );
        return { conditions, orderBy: this.buildOrder(sort, order) };
      }
    }
  }

  /**
   * Builds eligibility condition based on mode.
   */
  private buildEligibilityCondition(eligibilityMode: EligibilityMode) {
    if (eligibilityMode === ELIGIBILITY_MODE.NONE) {
      return null;
    }

    if (eligibilityMode === ELIGIBILITY_MODE.FRESHNESS) {
      return or(
        eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
        and(
          eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.INELIGIBLE),
          sql`${schema.mediaCatalogEvaluations.reasons} = ARRAY['MISSING_GLOBAL_SIGNALS']::text[]`,
        ),
      );
    }

    return eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE);
  }

  private buildOrder(sort: CatalogSort, order: SortOrder) {
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

  private async countTotal(
    conditions: any[],
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
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(and(...conditions));
    return Number(total ?? 0);
  }
}
