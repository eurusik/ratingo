/**
 * Media image URL utilities.
 * Handles images from different sources (TMDB, TVMaze, etc.)
 *
 * Proxy: when NEXT_PUBLIC_IMAGE_PROXY_ORIGIN is set (e.g. https://img.ratingo.top),
 * TMDB images route through {origin}/tmdb/ and TVMaze through {origin}/tvmaze/.
 * Backend handles TMDB proxy via IMAGE_PROXY_BASE_URL env var separately.
 * TVMaze URLs are stored as full URLs in DB and rewritten client-side only.
 */

/** Image proxy origin (e.g. https://img.ratingo.top) */
const IMAGE_PROXY_ORIGIN = process.env.NEXT_PUBLIC_IMAGE_PROXY_ORIGIN || null;

/** TMDB image base URL */
export const MEDIA_IMAGE_BASE = IMAGE_PROXY_ORIGIN
  ? `${IMAGE_PROXY_ORIGIN}/tmdb`
  : 'https://image.tmdb.org/t/p';

/** TVMaze image proxy */
const TVMAZE_IMAGE_ORIGIN = 'https://static.tvmaze.com/uploads/images/';
const TVMAZE_IMAGE_PROXY = IMAGE_PROXY_ORIGIN
  ? `${IMAGE_PROXY_ORIGIN}/tvmaze/`
  : null;

/** Common image sizes (TMDB-specific, TVMaze images don't use size prefixes) */
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
 * - TVMaze full URLs - rewritten to proxy if configured
 * - Other full URLs (Railway, etc.) - returned as-is
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
  // TVMaze full URL - rewrite to proxy if configured
  if (TVMAZE_IMAGE_PROXY && path.startsWith(TVMAZE_IMAGE_ORIGIN)) {
    return path.replace(TVMAZE_IMAGE_ORIGIN, TVMAZE_IMAGE_PROXY);
  }
  // Other full URLs (Railway, etc.) - return as-is
  if (path.startsWith('http')) return path;
  // TMDB path - build full URL
  return `${MEDIA_IMAGE_BASE}/${size}${path}`;
}
