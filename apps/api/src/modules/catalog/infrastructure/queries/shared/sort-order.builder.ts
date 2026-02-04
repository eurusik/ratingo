import { sql, type SQL } from 'drizzle-orm';

import * as schema from '../../../../../database/schema';
import {
  CATALOG_SORT,
  type CatalogSort,
  type SortOrder,
} from '../../../domain/constants/catalog-query.constants';
import {
  MOVIE_TRENDING_WEIGHTS,
  WATCHERS_FALLBACK,
} from '../../../domain/constants/catalog.constants';

/**
 * Builds SQL ORDER BY clause for movie queries.
 *
 * Handles all CatalogSort options:
 * - trending: composite formula (ratingo + popularity + watchers + tmdb)
 * - ratingo: sort by ratingoScore
 * - releaseDate: sort by releaseDate with createdAt fallback
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

  if (sort === CATALOG_SORT.RELEASE_DATE) {
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
