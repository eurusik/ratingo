/**
 * Genre Mapping Constants
 *
 * Maps external provider genre IDs to internal classification logic.
 * These are infrastructure-level constants used by classification service.
 *
 * Note: Kept in domain/constants for co-location with classification logic,
 * but these IDs are provider-specific (TMDB). If we add more providers,
 * consider moving to infrastructure/adapters/.
 */

/**
 * TMDB Genre IDs used for content classification.
 * These are stable IDs from TMDB API.
 *
 * @see https://developers.themoviedb.org/3/genres/get-movie-list
 */
export const TMDB_GENRE_IDS = {
  ANIMATION: 16,
  DOCUMENTARY: 99,
  REALITY: 10764,
  KIDS: 10762,
  /** Family genre - NOT auto-classified as kids (too broad) */
  FAMILY: 10751,
} as const;

export type TmdbGenreId = (typeof TMDB_GENRE_IDS)[keyof typeof TMDB_GENRE_IDS];
