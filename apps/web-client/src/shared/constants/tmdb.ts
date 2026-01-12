/**
 * TMDB image URL constants.
 * @see https://developer.themoviedb.org/docs/image-basics
 */

/** Base URL for TMDB images */
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/** Poster sizes */
export const TMDB_POSTER_SIZES = {
  /** 92px width - tiny thumbnails */
  W92: 'w92',
  /** 154px width - small cards */
  W154: 'w154',
  /** 185px width - profile images */
  W185: 'w185',
  /** 342px width - medium cards */
  W342: 'w342',
  /** 500px width - large cards */
  W500: 'w500',
  /** 780px width - hero images */
  W780: 'w780',
  /** Original size */
  ORIGINAL: 'original',
} as const;

/** Build TMDB image URL */
export function tmdbImageUrl(path: string | null | undefined, size: string = TMDB_POSTER_SIZES.W342): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
