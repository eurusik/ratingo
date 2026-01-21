import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { hasRecentEpisode } from '../../../../common/utils/media.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  EligibilityStatus,
  EvaluationContext,
  type EvaluationContextType,
} from '../../../catalog-policy/public';
import {
  CONTEXT_FRESHNESS,
  SHOW_TRENDING_WEIGHTS,
  NEW_RELEASE_THRESHOLDS,
  CLASSIC_THRESHOLDS,
  LIST_CONTEXT,
} from '../../domain/constants/catalog.constants';
import {
  type TrendingShowItem,
  type TrendingShowsOptions,
} from '../../domain/repositories/show.repository.interface';
import type { TrendingQueryResult } from '../../domain/types/query.types';
import {
  type CatalogSort,
  type SortOrder,
  type VoteSource,
  VOTE_SOURCE,
  CATALOG_SORT,
  SORT_ORDER,
} from '../../presentation/dtos/catalog-list-query.dto';

/**
 * Raw row type from trending shows query.
 */
interface TrendingShowRow {
  id: string;
  tmdb_id: number;
  title: string;
  original_title: string | null;
  slug: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: Date | null;
  videos: unknown;
  ingestion_status: string;
  rating: number;
  vote_count: number;
  rating_imdb: number | null;
  vote_count_imdb: number | null;
  rating_trakt: number | null;
  vote_count_trakt: number | null;
  rating_metacritic: number | null;
  rating_rotten_tomatoes: number | null;
  popularity: number;
  ratingo_score: number | null;
  quality_score: number | null;
  popularity_score: number | null;
  watchers_count: number | null;
  total_watchers: number | null;
  last_air_date: Date | null;
  next_air_date: Date | null;
  season_number: number | null;
  episode_number: number | null;
}

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
      const evaluationsExist = await this.checkContextEvaluationsExist(EvaluationContext.TRENDING);

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

      // Freshness gate: threshold based on context and sort mode
      const freshnessThreshold = CONTEXT_FRESHNESS[context][sort] ?? 0;
      if (freshnessThreshold > 0) {
        whereConditions.push(sql`COALESCE(ms.freshness_score, 0) >= ${freshnessThreshold}`);
      }

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

        ORDER BY ${this.buildOrderBy(sort, order)}
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

      const mapped = this.mapResults(results as unknown as TrendingShowRow[]);
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

  /**
   * Maps raw database rows to TrendingShowItem DTOs.
   */
  private mapResults(results: TrendingShowRow[]): TrendingShowItem[] {
    const now = new Date();
    const newReleaseCutoff = new Date();
    newReleaseCutoff.setDate(now.getDate() - NEW_RELEASE_THRESHOLDS.DAYS);

    const classicCutoff = new Date();
    classicCutoff.setFullYear(now.getFullYear() - CLASSIC_THRESHOLDS.YEARS_OLD);

    return results.map((row: TrendingShowRow) => {
      const releaseDate = row.release_date ? new Date(row.release_date) : null;

      return {
        id: row.id,
        mediaItemId: row.id,
        type: MediaType.SHOW,
        slug: row.slug,
        title: row.title,
        originalTitle: row.original_title,
        overview: row.overview,
        ingestionStatus: row.ingestion_status as IngestionStatus,
        primaryTrailerKey: row.videos?.[0]?.key || null,
        poster: ImageMapper.toPoster(row.poster_path),
        backdrop: ImageMapper.toBackdrop(row.backdrop_path),
        releaseDate,

        isNew: releaseDate ? releaseDate >= newReleaseCutoff : false,
        isClassic: releaseDate
          ? releaseDate <= classicCutoff ||
            ((row.ratingo_score || 0) >= CLASSIC_THRESHOLDS.RATINGO_SCORE &&
              (row.total_watchers || 0) > CLASSIC_THRESHOLDS.TOTAL_WATCHERS)
          : false,

        stats: {
          ratingoScore: row.ratingo_score,
          qualityScore: row.quality_score,
          popularityScore: row.popularity_score,
          liveWatchers: row.watchers_count,
          totalWatchers: row.total_watchers,
        },
        externalRatings: {
          tmdb: { rating: row.rating, voteCount: row.vote_count },
          imdb: row.rating_imdb
            ? { rating: row.rating_imdb, voteCount: row.vote_count_imdb }
            : null,
          trakt: row.rating_trakt
            ? { rating: row.rating_trakt, voteCount: row.vote_count_trakt }
            : null,
          metacritic: row.rating_metacritic ? { rating: row.rating_metacritic } : null,
          rottenTomatoes: row.rating_rotten_tomatoes
            ? { rating: row.rating_rotten_tomatoes }
            : null,
        },

        showProgress: this.buildShowProgress(row),

        hasRecentEpisode: hasRecentEpisode(row.last_air_date),
      };
    });
  }

  /**
   * Builds show progress object with season/episode label.
   */
  private buildShowProgress(row: TrendingShowRow) {
    let label: string | null = null;
    if (row.season_number != null && row.episode_number != null) {
      label = `S${row.season_number}E${row.episode_number}`;
    }

    return {
      lastAirDate: row.last_air_date ? new Date(row.last_air_date) : null,
      nextAirDate: row.next_air_date ? new Date(row.next_air_date) : null,
      season: row.season_number ?? null,
      episode: row.episode_number ?? null,
      label,
    };
  }

  /**
   * Builds ORDER BY clause based on sort option.
   */
  private buildOrderBy(sort: CatalogSort | undefined, order: SortOrder) {
    const dir = order === 'asc' ? sql`ASC` : sql`DESC`;
    const w = SHOW_TRENDING_WEIGHTS;
    switch (sort) {
      case 'trending': {
        // Combined trending score with live engagement signal
        // Uses weights from domain constants for consistency
        return sql`(
          COALESCE(ms.ratingo_score, 0) * ${w.RATINGO} +
          COALESCE(ms.popularity_score, 0) * ${w.POPULARITY} +
          (COALESCE(ms.watchers_count, 0)::float / (COALESCE(ms.watchers_count, 0) + ${w.WATCHERS_SATURATION_K})) * 100 * ${w.WATCHERS} +
          COALESCE(mi.trending_score, 0) / 100.0 * ${w.TMDB}
        ) ${dir} NULLS LAST, mi.id DESC`;
      }
      case 'ratingo':
        return sql`ms.ratingo_score ${dir} NULLS LAST, mi.id DESC`;
      case 'releaseDate':
        // For shows: prioritize last_air_date (recent episodes) over release_date (premiere)
        // Fallback to created_at for incomplete data
        return sql`COALESCE(s.last_air_date, mi.release_date, mi.created_at) ${dir} NULLS LAST, mi.id DESC`;
      case 'tmdbPopularity':
        return sql`mi.popularity ${dir}, mi.id DESC`;
      default:
        return sql`ms.popularity_score ${dir} NULLS LAST, mi.id DESC`;
    }
  }
}
