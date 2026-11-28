import { TMDB_IMAGE_BASE_URL, TVMAZE_IMAGE_PROXY_BASE_URL } from './env';

const ABSOLUTE_URL = /^https?:\/\//;
const TVMAZE_IMAGE_URL = /^https?:\/\/static\.tvmaze\.com\/uploads\/images\//;
const TMDB_SIZE_SEGMENT = /(\/(?:tmdb|t\/p)\/)(?:w\d+|original)\//;

export type TmdbPosterWidth = 'w92' | 'w154' | 'w185' | 'w342' | 'w500';

const URL_ORIGIN = /^https?:\/\/[^/]+/;

export const IMAGE_HOST_ORIGIN = TMDB_IMAGE_BASE_URL.match(URL_ORIGIN)?.[0];

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

export type TmdbStillWidth = 'w300' | 'w780';

export function tmdbStillUrl(
  path: string | null | undefined,
  width: TmdbStillWidth = 'w300',
): string | undefined {
  if (!path) return undefined;
  if (ABSOLUTE_URL.test(path)) return absoluteImageUrl(path);
  return `${TMDB_IMAGE_BASE_URL}/${width}${path}`;
}

export function tmdbPosterSrcSet(
  url: string | undefined,
  widths: readonly TmdbPosterWidth[],
): string | undefined {
  if (!url || !TMDB_SIZE_SEGMENT.test(url)) return undefined;
  return widths.map((width) => `${posterUrlAtWidth(url, width)} ${pixelWidth(width)}w`).join(', ');
}

function posterUrlAtWidth(url: string, width: TmdbPosterWidth): string {
  return url.replace(TMDB_SIZE_SEGMENT, (_, base: string) => `${base}${width}/`);
}

function pixelWidth(width: TmdbPosterWidth): string {
  return width.slice(1);
}
