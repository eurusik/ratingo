import { sql, type SQL } from 'drizzle-orm';

import * as schema from '../../../../../database/schema';
import {
  CATALOG_SORT,
  type CatalogSort,
  type SortOrder,
} from '../../../domain/constants/catalog-query.constants';
import {
  MOVIE_TRENDING_WEIGHTS,
  SHOW_TRENDING_WEIGHTS,
  WATCHERS_FALLBACK,
} from '../../../domain/constants/catalog.constants';

/**
 * Builds SQL ORDER BY clause for movie queries.
 *
 * Handles all CatalogSort options:
 * - trending: composite formula (ratingo + popularity + watchers + tmdb)
 * - ratingo: sort by ratingoScore
 * - releaseDate: sort by releaseDate with createdAt fallback
 * - lastAirDate: falls back to releaseDate behavior (movies have no episode air dates)
 * - tmdbPopularity: sort by raw TMDB popularity
 * - popularity (default): sort by aggregated popularityScore
 *
 * @param sort - Sort field
 * @param order - Sort direction (asc/desc)
 * @returns Array of SQL expressions for ORDER BY
 */
export function buildMovieSortOrder(sort: CatalogSort, order: SortOrder): SQL[] {
  const dir = order === 'asc' ? sql`asc` : sql`desc`;
  const nullsLast = sql`NULLS LAST`;

  if (sort === CATALOG_SORT.TRENDING) {
    const w = MOVIE_TRENDING_WEIGHTS;
    return [
      sql`(
        COALESCE(${schema.mediaStats.ratingoScore}, 0) * ${w.RATINGO} +
        COALESCE(${schema.mediaStats.popularityScore}, 0) * ${w.POPULARITY} +
        CASE
          WHEN COALESCE(${schema.mediaStats.watchersCount}, 0) > 0 THEN
            (${schema.mediaStats.watchersCount}::float / (${schema.mediaStats.watchersCount} + ${w.WATCHERS_SATURATION_K})) * 100
          ELSE
            LEAST(LN(1 + COALESCE(${schema.mediaStats.totalWatchers}, 0)) * ${WATCHERS_FALLBACK.LOG_MULTIPLIER}, ${WATCHERS_FALLBACK.MAX_SIGNAL})
        END * ${w.WATCHERS} +
        COALESCE(${schema.mediaItems.trendingScore}, 0) / 100.0 * ${w.TMDB}
      ) ${dir} ${nullsLast}`,
      sql`${schema.mediaItems.id} desc`,
    ];
  }

  if (sort === CATALOG_SORT.RATINGO) {
    return [sql`${schema.mediaStats.ratingoScore} ${dir}`, sql`${schema.mediaItems.id} desc`];
  }

  if (sort === CATALOG_SORT.RELEASE_DATE || sort === CATALOG_SORT.LAST_AIR_DATE) {
    // Movies don't have episode air dates, so lastAirDate falls back to
    // releaseDate behavior: COALESCE(release_date, created_at).
    return [
      sql`COALESCE(${schema.mediaItems.releaseDate}, ${schema.mediaItems.createdAt}) ${dir} ${nullsLast}`,
      sql`${schema.mediaItems.id} desc`,
    ];
  }

  if (sort === CATALOG_SORT.TMDB_POPULARITY) {
    return [sql`${schema.mediaItems.popularity} ${dir}`, sql`${schema.mediaItems.id} desc`];
  }

  // Default: popularity
  return [sql`${schema.mediaStats.popularityScore} ${dir}`, sql`${schema.mediaItems.id} desc`];
}

/**
 * Builds SQL ORDER BY clause for show queries (raw SQL style).
 *
 * Key differences from movies:
 * - Uses SHOW_TRENDING_WEIGHTS (higher watchers weight for ongoing engagement)
 * - Has lastAirDate sort (last episode air date) not available for movies
 *
 * Note: Returns a single SQL expression (not array) for use with raw SQL queries.
 * The tiebreaker (mi.id DESC) is included in the expression.
 *
 * @param sort - Sort field
 * @param order - Sort direction (asc/desc)
 * @returns SQL expression for ORDER BY clause
 */
export function buildShowSortOrder(sort: CatalogSort, order: SortOrder): SQL {
  const dir = order === 'asc' ? sql`ASC` : sql`DESC`;
  const w = SHOW_TRENDING_WEIGHTS;

  if (sort === CATALOG_SORT.TRENDING) {
    // Combined trending score with live engagement signal
    // Uses weights from domain constants for consistency
    // Fallback formula: when watchers_count=0, use log-compressed total_watchers
    return sql`(
      COALESCE(ms.ratingo_score, 0) * ${w.RATINGO} +
      COALESCE(ms.popularity_score, 0) * ${w.POPULARITY} +
      CASE
        WHEN COALESCE(ms.watchers_count, 0) > 0 THEN
          (ms.watchers_count::float / (ms.watchers_count + ${w.WATCHERS_SATURATION_K})) * 100
        ELSE
          LEAST(LN(1 + COALESCE(ms.total_watchers, 0)) * ${WATCHERS_FALLBACK.LOG_MULTIPLIER}, ${WATCHERS_FALLBACK.MAX_SIGNAL})
      END * ${w.WATCHERS} +
      COALESCE(mi.trending_score, 0) / 100.0 * ${w.TMDB}
    ) ${dir} NULLS LAST, mi.id DESC`;
  }

  if (sort === CATALOG_SORT.RATINGO) {
    return sql`ms.ratingo_score ${dir} NULLS LAST, mi.id DESC`;
  }

  if (sort === CATALOG_SORT.RELEASE_DATE) {
    // Sort by premiere date (release_date), not last episode air date
    return sql`COALESCE(mi.release_date, mi.created_at) ${dir} NULLS LAST, mi.id DESC`;
  }

  if (sort === CATALOG_SORT.LAST_AIR_DATE) {
    // Sort by most recent episode air date (shows only)
    return sql`COALESCE(s.last_air_date, mi.release_date, mi.created_at) ${dir} NULLS LAST, mi.id DESC`;
  }

  if (sort === CATALOG_SORT.TMDB_POPULARITY) {
    return sql`mi.popularity ${dir}, mi.id DESC`;
  }

  // Default: popularity
  return sql`ms.popularity_score ${dir} NULLS LAST, mi.id DESC`;
}
