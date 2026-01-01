import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, gte, lte, isNotNull, inArray, and, exists, sql, isNull, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus } from '../../../catalog-policy/public';
import {
  TRENDING_THRESHOLDS,
  MOVIE_TRENDING_WEIGHTS,
} from '../../domain/constants/catalog.constants';
import type {
  TrendingMovieItem,
  WithTotal,
} from '../../domain/repositories/movie.repository.interface';
import {
  type CatalogSort,
  type SortOrder,
  type VoteSource,
  CATALOG_SORT,
  SORT_ORDER,
  VOTE_SOURCE,
} from '../../presentation/dtos/catalog-list-query.dto';

import { GenreQuery } from './shared/genre.query';
import { MovieResultMapper } from './shared/movie-result.mapper';
import { movieSelectFields, type MovieSelectRow } from './shared/movie-select.fields';

/**
 * Options for trending movies query.
 */
export interface TrendingMoviesOptions {
  limit?: number;
  offset?: number;
  minRatingo?: number;
  genres?: string[];
  sort?: CatalogSort;
  order?: SortOrder;
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
}

/**
 * Fetches trending movies sorted by popularity and rating.
 *
 * Retrieves movies with stats, external ratings, and genres,
 * applying optional filters for rating and genre.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class TrendingMoviesQuery {
  private readonly logger = new Logger(TrendingMoviesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly genreQuery: GenreQuery,
  ) {}

  /**
   * Executes the trending movies query.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * @param {TrendingMoviesOptions} options - Query options (limit, offset, filters)
   * @returns {Promise<WithTotal<TrendingMovieItem>>} List of trending movies with stats and genres
   * @throws {DatabaseException} When database query fails
   */
  async execute(options: TrendingMoviesOptions): Promise<WithTotal<TrendingMovieItem>> {
    const {
      limit = 20,
      offset = 0,
      minRatingo,
      genres,
      sort = CATALOG_SORT.POPULARITY,
      order = SORT_ORDER.DESC,
      voteSource = VOTE_SOURCE.TMDB,
      minVotes,
      year,
      yearFrom,
      yearTo,
    } = options;

    try {
      const conditions: SQL[] = [
        isNotNull(schema.mediaStats.popularityScore),
        eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
        eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
        isNull(schema.mediaItems.deletedAt),
      ];

      // Trending hard gate: only new content OR actively watched
      if (sort === CATALOG_SORT.TRENDING) {
        conditions.push(
          sql`(
            COALESCE(${schema.mediaStats.freshnessScore}, 0) >= ${TRENDING_THRESHOLDS.MIN_FRESHNESS}
            OR COALESCE(${schema.mediaStats.watchersCount}, 0) >= ${TRENDING_THRESHOLDS.MIN_WATCHERS}
          )`,
        );
      }

      if (minRatingo !== undefined) {
        conditions.push(gte(schema.mediaStats.ratingoScore, minRatingo));
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

      if (minVotes !== undefined) {
        if (voteSource === 'trakt') {
          conditions.push(gte(schema.mediaItems.voteCountTrakt, minVotes));
        } else {
          conditions.push(gte(schema.mediaItems.voteCount, minVotes));
        }
      }

      if (year !== undefined) {
        const { start, end } = this.buildYearRange(year);
        conditions.push(
          isNotNull(schema.mediaItems.releaseDate),
          gte(schema.mediaItems.releaseDate, start),
          lte(schema.mediaItems.releaseDate, end),
        );
      } else if (yearFrom !== undefined || yearTo !== undefined) {
        if (yearFrom !== undefined) {
          const start = this.buildYearStart(yearFrom);
          conditions.push(
            isNotNull(schema.mediaItems.releaseDate),
            gte(schema.mediaItems.releaseDate, start),
          );
        }
        if (yearTo !== undefined) {
          const end = this.buildYearStart(yearTo + 1);
          conditions.push(
            isNotNull(schema.mediaItems.releaseDate),
            lte(schema.mediaItems.releaseDate, end),
          );
        }
      }

      const results = await this.db
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
        .orderBy(...this.buildOrder(sort, order))
        .limit(limit)
        .offset(offset);

      const total = await this.countTotal(conditions);
      const mediaItemIds = results.map((m) => m.mediaItemId);
      const genresMap = await this.genreQuery.fetchForMediaItems(mediaItemIds);

      const mapped = MovieResultMapper.mapManyTrending(results as MovieSelectRow[], genresMap);
      const withTotal = mapped as WithTotal<TrendingMovieItem>;
      withTotal.total = total;
      return withTotal;
    } catch (error) {
      this.logger.error(`Failed to find trending movies: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch trending movies', {
        originalError: error.message,
      });
    }
  }

  private buildYearStart(year: number): Date {
    return new Date(Date.UTC(year, 0, 1));
  }

  private buildYearRange(year: number): { start: Date; end: Date } {
    const start = this.buildYearStart(year);
    const end = this.buildYearStart(year + 1);
    return { start, end };
  }

  private buildOrder(sort: CatalogSort, order: SortOrder) {
    const dir = order === 'asc' ? sql`asc` : sql`desc`;
    const nullsLast = sql`NULLS LAST`;

    if (sort === 'trending') {
      const w = MOVIE_TRENDING_WEIGHTS;
      return [
        sql`(
          COALESCE(${schema.mediaStats.ratingoScore}, 0) * ${w.RATINGO} +
          COALESCE(${schema.mediaStats.popularityScore}, 0) * ${w.POPULARITY} +
          (COALESCE(${schema.mediaStats.watchersCount}, 0)::float / (COALESCE(${schema.mediaStats.watchersCount}, 0) + ${w.WATCHERS_SATURATION_K})) * 100 * ${w.WATCHERS} +
          COALESCE(${schema.mediaItems.trendingScore}, 0) / 100.0 * ${w.TMDB}
        ) ${dir} ${nullsLast}`,
        sql`${schema.mediaItems.id} desc`,
      ];
    }
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

  private async countTotal(conditions: SQL[]): Promise<number> {
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
