import { eq, gte, isNotNull, inArray, and, exists, sql, isNull, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import * as schema from '../../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../../catalog-policy/public';
import type { VoteSource } from '../../../domain/constants/catalog-query.constants';
import {
  CONTEXT_FRESHNESS,
  TRENDING_THRESHOLDS,
} from '../../../domain/constants/catalog.constants';
import type { ListContext } from '../../../domain/types/query.types';

import { buildYearConditions } from './year-range.util';

export interface TrendingMovieConditionsOptions {
  context: ListContext;
  minRatingo?: number;
  genres?: string[];
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
}

/**
 * Builds WHERE conditions for trending movies query.
 *
 * Includes base conditions for:
 * - Popularity score exists
 * - Eligible evaluation status for trending context
 * - Ready ingestion status
 * - Not soft-deleted
 * - Freshness threshold based on context
 * - Minimum watchers threshold
 *
 * Plus optional filters for: minRatingo, genres, minVotes, year range.
 *
 * @param db - Drizzle database instance (needed for genre subquery)
 * @param options - Filtering options
 * @returns Array of SQL conditions for WHERE clause
 */
export function buildTrendingMovieConditions(
  db: PostgresJsDatabase<typeof schema>,
  options: TrendingMovieConditionsOptions,
): SQL[] {
  const { context, minRatingo, genres, voteSource, minVotes, year, yearFrom, yearTo } = options;

  const conditions: SQL[] = [
    isNotNull(schema.mediaStats.popularityScore),
    eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
    eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
    eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
    isNull(schema.mediaItems.deletedAt),
  ];

  const freshnessThreshold = CONTEXT_FRESHNESS[context].trending;
  if (freshnessThreshold > 0) {
    conditions.push(sql`COALESCE(${schema.mediaStats.freshnessScore}, 0) >= ${freshnessThreshold}`);
  }

  // Trending without audience is just "recent" - enforce minimum traction
  conditions.push(
    sql`COALESCE(${schema.mediaStats.watchersCount}, 0) >= ${TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES}`,
  );

  if (minRatingo !== undefined) {
    conditions.push(gte(schema.mediaStats.ratingoScore, minRatingo));
  }

  if (genres && genres.length) {
    conditions.push(
      exists(
        db
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

  conditions.push(...buildYearConditions(schema.mediaItems.releaseDate, year, yearFrom, yearTo));

  return conditions;
}
