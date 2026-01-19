/**
 * Media image URL utilities.
 * Handles images from different sources (TMDB, TVMaze, etc.)
 */

/** TMDB image base URL */
export const MEDIA_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/** Common image sizes */
export const IMAGE_SIZES = {
  /** 92px - tiny thumbnails */
  W92: 'w92',
  /** 154px - small cards */
  W154: 'w154',
  /** 185px - profile images */
  W185: 'w185',
  /** 300px - episode stills */
  W300: 'w300',
  /** 342px - medium cards */
  W342: 'w342',
  /** 500px - large cards */
  W500: 'w500',
  /** 780px - hero images */
  W780: 'w780',
  /** Original size */
  ORIGINAL: 'original',
} as const;

/**
 * Resolves media image URL from different sources.
 * - Full URLs (TVMaze, etc.) - returned as-is
 * - TMDB paths - prepends TMDB base URL with size
 *
 * @param path - Image path or full URL
 * @param size - Image size (default: w342)
 * @returns Full image URL or null
 */
export function resolveMediaImageUrl(
  path: string | null | undefined,
  size: string = IMAGE_SIZES.W342,
): string | null {
  if (!path) return null;
  // Full URL (TVMaze, Railway, etc.) - return as-is
  if (path.startsWith('http')) return path;
  // TMDB path - build full URL
  return `${MEDIA_IMAGE_BASE}/${size}${path}`;
}
