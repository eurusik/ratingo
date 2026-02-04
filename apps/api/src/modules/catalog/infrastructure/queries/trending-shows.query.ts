import { Inject, Injectable, Logger } from '@nestjs/common';

import { sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import {
  CATALOG_SORT,
  SORT_ORDER,
  VOTE_SOURCE,
  type VoteSource,
} from '../../domain/constants/catalog-query.constants';
import {
  CONTEXT_FRESHNESS,
  LIST_CONTEXT,
  TRENDING_THRESHOLDS,
} from '../../domain/constants/catalog.constants';
import {
  type TrendingShowItem,
  type TrendingShowsOptions,
} from '../../domain/repositories/show.repository.interface';
import type { TrendingQueryResult } from '../../domain/types/query.types';

import { checkContextEvaluationsExist } from './shared/evaluation-check.util';
import { ShowResultMapper } from './shared/show-result.mapper';
import type { ShowSelectRow } from './shared/show-select.fields';
import { buildShowSortOrder } from './shared/sort-order.builder';

/**
 * Fetches trending TV shows with episode progress.
 *
 * Uses PostgreSQL LATERAL JOIN to efficiently retrieve the latest aired
 * episode for each show in a single query, avoiding N+1 problems.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class TrendingShowsQuery {
  private readonly logger = new Logger(TrendingShowsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the trending shows query.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * Returns degraded state if no evaluations exist for the trending context
   * with the active policy version.
   *
   * @param {TrendingShowsOptions} options - Query options (limit, offset, filters)
   * @returns {Promise<TrendingQueryResult<TrendingShowItem>>} List of trending shows with stats and progress
   * @throws {DatabaseException} When database query fails
   */
  async execute(options: TrendingShowsOptions): Promise<TrendingQueryResult<TrendingShowItem>> {
    const {
      limit = DEFAULT_PAGE_SIZE,
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

        const emptyResult: TrendingQueryResult<TrendingShowItem> =
          [] as TrendingQueryResult<TrendingShowItem>;
        emptyResult.total = 0;
        emptyResult.meta = {
          degraded: true,
          degradedReason: 'Context evaluations missing - evaluation in progress',
        };
        return emptyResult;
      }

      const whereConditions: SQL[] = [
        sql`mi.type = ${MediaType.SHOW}`,
        sql`mi.deleted_at IS NULL`,
        // Eligibility filter: only show ELIGIBLE items with trending context
        sql`mce.status = ${EligibilityStatus.ELIGIBLE}`,
        sql`mce.context = ${EvaluationContext.TRENDING}`,
        // Ready filter: only show items with ready ingestion status
        sql`mi.ingestion_status = ${IngestionStatus.READY}`,
      ];

      const freshnessThreshold = CONTEXT_FRESHNESS[context].trending;
      if (freshnessThreshold > 0) {
        whereConditions.push(sql`COALESCE(ms.freshness_score, 0) >= ${freshnessThreshold}`);
      }

      // Trending without audience is just "recent" - enforce minimum traction
      whereConditions.push(
        sql`COALESCE(ms.watchers_count, 0) >= ${TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS}`,
      );

      if (minRatingo !== undefined) {
        whereConditions.push(sql`ms.ratingo_score >= ${minRatingo}`);
      }

      if (genres && genres.length) {
        const genreList = sql.join(
          genres.map((g) => sql`${g}`),
          sql`, `,
        );
        whereConditions.push(sql`
          EXISTS (
            SELECT 1 FROM ${schema.mediaGenres} mg
            JOIN ${schema.genres} g ON g.id = mg.genre_id
            WHERE mg.media_item_id = mi.id AND g.slug IN (${genreList})
          )
        `);
      }

      if (minVotes !== undefined) {
        if (voteSource === ('trakt' satisfies VoteSource)) {
          whereConditions.push(sql`mi.vote_count_trakt >= ${minVotes}`);
        } else {
          whereConditions.push(sql`mi.vote_count >= ${minVotes}`);
        }
      }

      if (year !== undefined) {
        whereConditions.push(
          sql`mi.release_date IS NOT NULL`,
          sql`mi.release_date >= ${new Date(Date.UTC(year, 0, 1))}`,
          sql`mi.release_date < ${new Date(Date.UTC(year + 1, 0, 1))}`,
        );
      } else if (yearFrom !== undefined || yearTo !== undefined) {
        if (yearFrom !== undefined) {
          whereConditions.push(
            sql`mi.release_date IS NOT NULL`,
            sql`mi.release_date >= ${new Date(Date.UTC(yearFrom, 0, 1))}`,
          );
        }
        if (yearTo !== undefined) {
          whereConditions.push(
            sql`mi.release_date IS NOT NULL`,
            sql`mi.release_date < ${new Date(Date.UTC(yearTo + 1, 0, 1))}`,
          );
        }
      }

      const whereSql = sql.join(whereConditions, sql` AND `);

      const query = sql`
        SELECT
          mi.id,
          mi.tmdb_id,
          mi.title,
          mi.original_title,
          mi.slug,
          mi.overview,
          mi.poster_path,
          mi.backdrop_path,
          mi.release_date,
          mi.videos,
          mi.ingestion_status,

          mi.rating,
          mi.vote_count,
          mi.rating_imdb,
          mi.vote_count_imdb,
          mi.rating_trakt,
          mi.vote_count_trakt,
          mi.rating_metacritic,
          mi.rating_rotten_tomatoes,
          mi.popularity,

          ms.ratingo_score,
          ms.quality_score,
          ms.popularity_score,
          ms.watchers_count,
          ms.total_watchers,

          s.last_air_date,
          s.next_air_date,

          se.number AS season_number,
          ep.number AS episode_number

        FROM ${schema.mediaItems} mi
        JOIN ${schema.shows} s ON s.media_item_id = mi.id
        JOIN ${schema.catalogPolicies} cp ON cp.is_active = true
        JOIN ${schema.mediaCatalogEvaluations} mce
          ON mce.media_item_id = mi.id
          AND mce.policy_version = cp.version
          AND mce.context = ${EvaluationContext.TRENDING}
        LEFT JOIN ${schema.mediaStats} ms ON ms.media_item_id = mi.id

        LEFT JOIN LATERAL (
          SELECT e.season_id, e.number
          FROM ${schema.episodes} e
          WHERE e.show_id = s.id
            AND e.air_date IS NOT NULL
            AND e.air_date <= NOW()
          ORDER BY e.air_date DESC
          LIMIT 1
        ) ep ON TRUE
        LEFT JOIN ${schema.seasons} se ON se.id = ep.season_id

        WHERE ${whereSql}

        ORDER BY ${buildShowSortOrder(sort, order)}
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countQuery = sql`
        SELECT COUNT(*)::int AS total
        FROM ${schema.mediaItems} mi
        JOIN ${schema.shows} s ON s.media_item_id = mi.id
        JOIN ${schema.catalogPolicies} cp ON cp.is_active = true
        JOIN ${schema.mediaCatalogEvaluations} mce
          ON mce.media_item_id = mi.id
          AND mce.policy_version = cp.version
          AND mce.context = ${EvaluationContext.TRENDING}
        LEFT JOIN ${schema.mediaStats} ms ON ms.media_item_id = mi.id
        WHERE ${whereSql}
      `;

      const [results, totalRows] = await Promise.all([
        this.db.execute(query),
        this.db.execute(countQuery),
      ]);
      const typedTotalRows = totalRows as Array<{ total?: number | null }>;
      const total = Number(typedTotalRows[0]?.total ?? 0);

      const mapped = ShowResultMapper.mapManyTrending(results as unknown as ShowSelectRow[]);
      const withTotal = mapped as TrendingQueryResult<TrendingShowItem>;
      withTotal.total = total;
      withTotal.meta = { degraded: false };
      return withTotal;
    } catch (error) {
      this.logger.error(`Failed to find trending shows: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch trending shows', {
        originalError: error.message,
      });
    }
  }
}
