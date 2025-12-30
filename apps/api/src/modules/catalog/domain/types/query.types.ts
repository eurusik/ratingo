/**
 * Shared query types for catalog repositories.
 */

/**
 * Helper type for list queries that also return total count.
 */
export type WithTotal<T> = T[] & { total?: number };

/**
 * Sort options for catalog queries.
 */
export type CatalogSort = 'trending' | 'popularity' | 'ratingo' | 'releaseDate' | 'tmdbPopularity';

/**
 * Sort order.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Vote source for filtering.
 */
export type VoteSource = 'tmdb' | 'trakt';
