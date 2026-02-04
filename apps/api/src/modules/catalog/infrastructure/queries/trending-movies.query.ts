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
import {
  CONTEXT_FRESHNESS,
  LIST_CONTEXT,
  TRENDING_THRESHOLDS,
} from '../../domain/constants/catalog.constants';
import type { TrendingMovieItem } from '../../domain/repositories/movie.repository.interface';
import type { TrendingQueryResult, ListContext } from '../../domain/types/query.types';

import { checkContextEvaluationsExist } from './shared/evaluation-check.util';
import { GenreQuery } from './shared/genre.query';
import { MovieResultMapper } from './shared/movie-result.mapper';
import { movieSelectFields, type MovieSelectRow } from './shared/movie-select.fields';
import { buildMovieSortOrder } from './shared/sort-order.builder';
import { buildYearConditions } from './shared/year-range.util';

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
  /** List context for freshness filtering (default: catalog) */
  context?: ListContext;
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
      context = LIST_CONTEXT.CATALOG,
    } = options;

    try {
      // Check for degraded state before executing main query
      const evaluationsExist = await checkContextEvaluationsExist(
        this.db,
        EvaluationContext.TRENDING,
      );

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

      const freshnessThreshold = CONTEXT_FRESHNESS[context].trending;
      if (freshnessThreshold > 0) {
        conditions.push(
          sql`COALESCE(${schema.mediaStats.freshnessScore}, 0) >= ${freshnessThreshold}`,
        );
      }

      // Trending without audience is just "recent" — enforce minimum traction
      conditions.push(
        sql`COALESCE(${schema.mediaStats.watchersCount}, 0) >= ${TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES}`,
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
            eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
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
      this.logger.error(`Failed to find trending movies: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch trending movies', {
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
          eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(and(...conditions));
    return Number(total ?? 0);
  }
}
