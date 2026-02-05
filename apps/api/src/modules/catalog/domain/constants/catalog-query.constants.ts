/**
 * Domain constants for catalog query sorting and filtering.
 * This is the canonical source for CatalogSort, SortOrder, and VoteSource.
 */

/**
 * Sort options for catalog queries.
 */
export const CATALOG_SORT = {
  TRENDING: 'trending',
  POPULARITY: 'popularity',
  RATINGO: 'ratingo',
  RELEASE_DATE: 'releaseDate',
  TMDB_POPULARITY: 'tmdbPopularity',
} as const;
export const CATALOG_SORT_VALUES = Object.values(CATALOG_SORT);
export type CatalogSort = (typeof CATALOG_SORT_VALUES)[number];

/**
 * Sort order direction.
 */
export const SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const;
export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER];

/**
 * Vote source for minVotes filtering.
 */
export const VOTE_SOURCE = {
  TMDB: 'tmdb',
  TRAKT: 'trakt',
} as const;
export type VoteSource = (typeof VOTE_SOURCE)[keyof typeof VOTE_SOURCE];
