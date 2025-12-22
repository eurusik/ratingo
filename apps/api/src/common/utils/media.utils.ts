import { NEW_RELEASE_WINDOW_DAYS } from '../constants';

/**
 * Rating source labels for context display (matches verdict types).
 */
export const RATING_SOURCE = {
  IMDB: 'IMDb',
  TRAKT: 'Trakt',
  TMDB: 'TMDB',
} as const;

export type RatingSourceLabel = (typeof RATING_SOURCE)[keyof typeof RATING_SOURCE];

export interface RatingData {
  rating: number;
  voteCount?: number | null;
}

export interface ExternalRatings {
  imdb?: RatingData | null;
  trakt?: RatingData | null;
  tmdb?: RatingData | null;
}

/**
 * Gets the best available rating source (IMDb > Trakt > TMDB).
 */
export function getBestRating(ratings: ExternalRatings | null): {
  rating: RatingData | null;
  source: RatingSourceLabel | null;
} {
  if (ratings?.imdb) return { rating: ratings.imdb, source: RATING_SOURCE.IMDB };
  if (ratings?.trakt) return { rating: ratings.trakt, source: RATING_SOURCE.TRAKT };
  if (ratings?.tmdb) return { rating: ratings.tmdb, source: RATING_SOURCE.TMDB };
  return { rating: null, source: null };
}

/**
 * Checks if a date is within the "new release" window.
 * @param releaseDate - Release date to check
 * @param windowDays - Number of days to consider as "new" (default: 14)
 */
export function isNewRelease(
  releaseDate: Date | string | null,
  windowDays = NEW_RELEASE_WINDOW_DAYS,
): boolean {
  if (!releaseDate) return false;
  const date = releaseDate instanceof Date ? releaseDate : new Date(releaseDate);
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= windowDays;
}

/**
 * Checks if a show has a new episode (aired within the past week).
 */
export function hasRecentEpisode(nextAirDate: Date | string | null): boolean {
  if (!nextAirDate) return false;
  const date = nextAirDate instanceof Date ? nextAirDate : new Date(nextAirDate);
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo && date <= now;
}
