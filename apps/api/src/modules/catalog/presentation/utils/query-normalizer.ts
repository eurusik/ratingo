import {
  CATALOG_DEFAULT_LIMIT,
  CATALOG_DEFAULT_OFFSET,
  CATALOG_MAX_DAYS_BACK,
} from '../../../../common/constants';
import { type CatalogListQueryDto } from '../dtos/catalog-list-query.dto';

/**
 * Normalized query with parsed genres array.
 */
export type NormalizedQuery<T extends CatalogListQueryDto> = T & { genres?: string[] };

/**
 * Normalizes catalog list query by parsing comma-separated genres into an array.
 *
 * @param {T} query - Incoming query DTO with genres as comma-separated string
 * @returns {NormalizedQuery<T>} Query with genres parsed into string array
 */
export function normalizeListQuery<T extends CatalogListQueryDto>(query: T): NormalizedQuery<T> {
  const genres =
    query.genres
      ?.split(',')
      .map((g) => g.trim())
      .filter((g) => g.length > 0) || undefined;

  return { ...query, genres } as NormalizedQuery<T>;
}

/**
 * Resolves daysBack parameter with fallback to default value.
 * Clamps to CATALOG_MAX_DAYS_BACK to prevent heavy database queries.
 *
 * @param daysBack - User-provided days back value
 * @param defaultDays - Default value when daysBack is not provided or invalid
 * @returns Resolved daysBack value clamped to maximum
 */
export function resolveDaysBack(daysBack: number | undefined, defaultDays: number): number {
  if (daysBack === undefined || daysBack <= 0) return defaultDays;
  return Math.min(daysBack, CATALOG_MAX_DAYS_BACK);
}

/**
 * Applies default pagination values to query.
 * Ensures limit and offset are always defined for explicit repository calls.
 *
 * @param query - Query with optional limit/offset
 * @returns Query with guaranteed limit and offset values
 */
export function applyPaginationDefaults<T extends { limit?: number; offset?: number }>(
  query: T,
): T & { limit: number; offset: number } {
  return {
    ...query,
    limit: query.limit ?? CATALOG_DEFAULT_LIMIT,
    offset: query.offset ?? CATALOG_DEFAULT_OFFSET,
  };
}
