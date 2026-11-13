import { TMDB_IMAGE_BASE_URL } from './env';

const ABSOLUTE_URL = /^https?:\/\//;

export type TmdbPosterWidth = 'w154' | 'w342';

export function tmdbPosterUrl(
  path: string | null | undefined,
  width: TmdbPosterWidth,
): string | undefined {
  if (!path) return undefined;
  if (ABSOLUTE_URL.test(path)) return path;
  return `${TMDB_IMAGE_BASE_URL}/${width}${path}`;
}
