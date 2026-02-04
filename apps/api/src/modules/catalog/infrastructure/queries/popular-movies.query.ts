import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, gte, isNotNull, inArray, and, exists, sql, isNull, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import {
  type CatalogSort,
  type SortOrder,
  type VoteSource,
  CATALOG_SORT,
  SORT_ORDER,
  VOTE_SOURCE,
} from '../../domain/constants/catalog-query.constants';
import { POPULAR_THRESHOLDS } from '../../domain/constants/catalog.constants';
import type { TrendingMovieItem } from '../../domain/repositories/movie.repository.interface';
import type { TrendingQueryResult } from '../../domain/types/query.types';

import { checkContextEvaluationsExist } from './shared/evaluation-check.util';
import { GenreQuery } from './shared/genre.query';
import { MovieResultMapper } from './shared/movie-result.mapper';
import { movieSelectFields, type MovieSelectRow } from './shared/movie-select.fields';
import { buildMovieSortOrder } from './shared/sort-order.builder';
import { buildYearConditions } from './shared/year-range.util';

/**
 * Options for popular movies query.
 */
export interface PopularMoviesOptions {
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
 * Fetches popular movies (Hits pool).
 *
 * Key differences from TrendingMoviesQuery:
 * - Uses EvaluationContext.CATALOG (not TRENDING)
 * - No freshness gate
 * - Gate: total_watchers >= POPULAR_THRESHOLDS.MIN_TOTAL_WATCHERS_MOVIES
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class PopularMoviesQuery {
  private readonly logger = new Logger(PopularMoviesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly genreQuery: GenreQuery,
  ) {}

  /**
   * Executes the popular movies query.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * Returns degraded state if no evaluations exist for the catalog context
   * with the active policy version.
   *
   * @param {PopularMoviesOptions} options - Query options (limit, offset, filters)
   * @returns {Promise<TrendingQueryResult<TrendingMovieItem>>} List of popular movies with stats and genres
   * @throws {DatabaseException} When database query fails
   */
  async execute(options: PopularMoviesOptions): Promise<TrendingQueryResult<TrendingMovieItem>> {
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
      // Check for degraded state before executing main query
      const evaluationsExist = await checkContextEvaluationsExist(
        this.db,
        EvaluationContext.CATALOG,
      );

      if (!evaluationsExist) {
        this.logger.warn(
          `Degraded state: no evaluations for context=${EvaluationContext.CATALOG} with active policy`,
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
        eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
        eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
        isNull(schema.mediaItems.deletedAt),
      ];

      // Popular pool gate: historical watchers (no freshness requirement)
      conditions.push(
        sql`COALESCE(${schema.mediaStats.totalWatchers}, 0) >= ${POPULAR_THRESHOLDS.MIN_TOTAL_WATCHERS_MOVIES}`,
      );

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

      conditions.push(
        ...buildYearConditions(schema.mediaItems.releaseDate, year, yearFrom, yearTo),
      );

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
            eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
          ),
        )
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...conditions))
        .orderBy(...buildMovieSortOrder(sort, order))
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
      this.logger.error(`Failed to find popular movies: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch popular movies', {
        originalError: error.message,
      });
    }
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
          eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(and(...conditions));
    return Number(total ?? 0);
  }
}
