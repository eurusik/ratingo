import { sql, type SQL } from 'drizzle-orm';

import { IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import * as schema from '../../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../../catalog-policy/public';
import type { VoteSource } from '../../../domain/constants/catalog-query.constants';
import {
  CONTEXT_FRESHNESS,
  TRENDING_THRESHOLDS,
} from '../../../domain/constants/catalog.constants';
import type { ListContext } from '../../../domain/types/query.types';

export interface ShowConditionsOptions {
  listContext?: ListContext;
  minRatingo?: number;
  genres?: string[];
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
}

/**
 * Builds WHERE conditions for trending shows query using raw SQL.
 *
 * Includes base conditions for:
 * - Media type = SHOW
 * - Not soft-deleted
 * - Eligible evaluation status for trending context
 * - Ready ingestion status
 * - Freshness threshold based on context
 * - Minimum watchers threshold
 *
 * Plus optional filters for: minRatingo, genres, minVotes, year range.
 *
 * Uses raw SQL style with sql template literals for compatibility with
 * LATERAL JOIN queries that use table aliases (mi, ms, mce, etc.).
 *
 * @param options - Filtering options
 * @returns Array of SQL conditions for WHERE clause
 */
export function buildTrendingShowConditions(options: ShowConditionsOptions): SQL[] {
  const {
    listContext = 'catalog',
    minRatingo,
    genres,
    voteSource,
    minVotes,
    year,
    yearFrom,
    yearTo,
  } = options;

  const conditions: SQL[] = [
    sql`mi.type = ${MediaType.SHOW}`,
    sql`mi.deleted_at IS NULL`,
    sql`mce.status = ${EligibilityStatus.ELIGIBLE}`,
    sql`mce.context = ${EvaluationContext.TRENDING}`,
    sql`mi.ingestion_status = ${IngestionStatus.READY}`,
  ];

  const freshnessThreshold = CONTEXT_FRESHNESS[listContext].trending;
  if (freshnessThreshold > 0) {
    conditions.push(sql`COALESCE(ms.freshness_score, 0) >= ${freshnessThreshold}`);
  }

  // Trending without audience is just "recent" - enforce minimum traction
  conditions.push(sql`COALESCE(ms.watchers_count, 0) >= ${TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS}`);

  if (minRatingo !== undefined) {
    conditions.push(sql`ms.ratingo_score >= ${minRatingo}`);
  }

  if (genres && genres.length) {
    const genreList = sql.join(
      genres.map((g) => sql`${g}`),
      sql`, `,
    );
    conditions.push(sql`
      EXISTS (
        SELECT 1 FROM ${schema.mediaGenres} mg
        JOIN ${schema.genres} g ON g.id = mg.genre_id
        WHERE mg.media_item_id = mi.id AND g.slug IN (${genreList})
      )
    `);
  }

  if (minVotes !== undefined) {
    if (voteSource === ('trakt' satisfies VoteSource)) {
      conditions.push(sql`mi.vote_count_trakt >= ${minVotes}`);
    } else {
      conditions.push(sql`mi.vote_count >= ${minVotes}`);
    }
  }

  if (year !== undefined) {
    conditions.push(
      sql`mi.release_date IS NOT NULL`,
      sql`mi.release_date >= ${new Date(Date.UTC(year, 0, 1))}`,
      sql`mi.release_date < ${new Date(Date.UTC(year + 1, 0, 1))}`,
    );
  } else if (yearFrom !== undefined || yearTo !== undefined) {
    if (yearFrom !== undefined) {
      conditions.push(
        sql`mi.release_date IS NOT NULL`,
        sql`mi.release_date >= ${new Date(Date.UTC(yearFrom, 0, 1))}`,
      );
    }
    if (yearTo !== undefined) {
      conditions.push(
        sql`mi.release_date IS NOT NULL`,
        sql`mi.release_date < ${new Date(Date.UTC(yearTo + 1, 0, 1))}`,
      );
    }
  }

  return conditions;
}
