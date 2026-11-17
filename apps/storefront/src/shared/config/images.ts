import { TMDB_IMAGE_BASE_URL, TVMAZE_IMAGE_PROXY_BASE_URL } from './env';

const ABSOLUTE_URL = /^https?:\/\//;
const TVMAZE_IMAGE_URL = /^https?:\/\/static\.tvmaze\.com\/uploads\/images\//;

export type TmdbPosterWidth = 'w154' | 'w342';

function absoluteImageUrl(url: string): string {
  if (!TVMAZE_IMAGE_PROXY_BASE_URL) return url;
  return url.replace(TVMAZE_IMAGE_URL, TVMAZE_IMAGE_PROXY_BASE_URL);
}

export function tmdbPosterUrl(
  path: string | null | undefined,
  width: TmdbPosterWidth,
): string | undefined {
  if (!path) return undefined;
  if (ABSOLUTE_URL.test(path)) return absoluteImageUrl(path);
  return `${TMDB_IMAGE_BASE_URL}/${width}${path}`;
}

export function tmdbStillUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (ABSOLUTE_URL.test(path)) return absoluteImageUrl(path);
  return `${TMDB_IMAGE_BASE_URL}/w300${path}`;
}
