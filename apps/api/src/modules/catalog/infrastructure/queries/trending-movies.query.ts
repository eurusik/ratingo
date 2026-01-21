import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, gte, lte, isNotNull, inArray, and, exists, sql, isNull, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  EligibilityStatus,
  EvaluationContext,
  type EvaluationContextType,
} from '../../../catalog-policy/public';
import {
  TRENDING_THRESHOLDS,
  MOVIE_TRENDING_WEIGHTS,
} from '../../domain/constants/catalog.constants';
import type { TrendingMovieItem } from '../../domain/repositories/movie.repository.interface';
import type { TrendingQueryResult } from '../../domain/types/query.types';
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
   * Returns degraded state if no evaluations exist for the trending context
   * with the active policy version.
   *
   * @param {TrendingMoviesOptions} options - Query options (limit, offset, filters)
   * @returns {Promise<TrendingQueryResult<TrendingMovieItem>>} List of trending movies with stats and genres
   * @throws {DatabaseException} When database query fails
   */
  async execute(options: TrendingMoviesOptions): Promise<TrendingQueryResult<TrendingMovieItem>> {
    const {
      limit = 20,
      offset = 0,
      minRatingo,
      genres,
      sort = CATALOG_SORT.TRENDING,
      order = SORT_ORDER.DESC,
      voteSource = VOTE_SOURCE.TMDB,
      minVotes,
      year,
      yearFrom,
      yearTo,
    } = options;

    try {
      // Check for degraded state before executing main query
      const evaluationsExist = await this.checkContextEvaluationsExist(EvaluationContext.TRENDING);

      if (!evaluationsExist) {
        this.logger.warn(
          `Degraded state: no evaluations for context=${EvaluationContext.TRENDING} with active policy`,
        );

        const emptyResult: TrendingQueryResult<TrendingMovieItem> =
          [] as TrendingQueryResult<TrendingMovieItem>;
        emptyResult.total = 0;
        emptyResult.meta = {
          degraded: true,
          degradedReason: 'Context evaluations missing - evaluation in progress',
        };
        return emptyResult;
      }

      const conditions: SQL[] = [
        isNotNull(schema.mediaStats.popularityScore),
        eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
        eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
        eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
        isNull(schema.mediaItems.deletedAt),
      ];

      // Trending hard gate: only fresh content (recent releases)
      if (sort === CATALOG_SORT.TRENDING) {
        conditions.push(
          sql`COALESCE(${schema.mediaStats.freshnessScore}, 0) >= ${TRENDING_THRESHOLDS.MIN_FRESHNESS}`,
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
            eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
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
      const withTotal = mapped as TrendingQueryResult<TrendingMovieItem>;
      withTotal.total = total;
      withTotal.meta = { degraded: false };
      return withTotal;
    } catch (error) {
      this.logger.error(`Failed to find trending movies: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch trending movies', {
        originalError: error.message,
      });
    }
  }

  /**
   * Checks if any evaluations exist for the given context with the active policy.
   * Used to detect degraded state when context evaluations are missing.
   *
   * @param context - The evaluation context to check
   * @returns True if evaluations exist, false otherwise
   */
  async checkContextEvaluationsExist(context: EvaluationContextType): Promise<boolean> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.mediaCatalogEvaluations)
      .innerJoin(
        schema.catalogPolicies,
        and(
          eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          eq(schema.catalogPolicies.isActive, true),
        ),
      )
      .where(eq(schema.mediaCatalogEvaluations.context, context))
      .limit(1);

    return (result[0]?.count ?? 0) > 0;
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
      // Fallback to created_at for incomplete data
      return [
        sql`COALESCE(${schema.mediaItems.releaseDate}, ${schema.mediaItems.createdAt}) ${dir} ${nullsLast}`,
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
          eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(and(...conditions));
    return Number(total ?? 0);
  }
}
