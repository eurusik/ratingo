/**
 * Shared query types for catalog repositories.
 */

// Re-export canonical types from domain constants
export type { CatalogSort, SortOrder, VoteSource } from '../constants/catalog-query.constants';

/**
 * Helper type for list queries that also return total count.
 */
export type WithTotal<T> = T[] & { total?: number };

/**
 * List context for freshness filtering.
 */
export type ListContext = 'home' | 'catalog';

/**
 * Metadata for trending query results.
 * Indicates whether the response is in a degraded state.
 */
export interface TrendingQueryMeta {
  /** True when evaluation data is incomplete for the requested context */
  degraded?: boolean;
  /** Human-readable reason for degraded state */
  degradedReason?: string;
}

/**
 * Result type for trending queries with optional metadata.
 * Extends WithTotal to include degraded state information.
 */
export type TrendingQueryResult<T> = WithTotal<T> & {
  meta?: TrendingQueryMeta;
};
