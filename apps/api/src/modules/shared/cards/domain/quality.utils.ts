import { HIT_AVG_RATING_THRESHOLD, HIT_MIN_VOTES_THRESHOLD } from './card.constants';

/**
 * External ratings structure from media details.
 */
export interface ExternalRatings {
  tmdb: { rating: number; voteCount?: number | null } | null;
  imdb: { rating: number; voteCount?: number | null } | null;
  trakt: { rating: number; voteCount?: number | null } | null;
  metacritic: { rating: number; voteCount?: number | null } | null;
  rottenTomatoes: { rating: number; voteCount?: number | null } | null;
}

/**
 * Calculates pure quality metrics from external ratings.
 * Returns avgRating (0-10) and totalVotes.
 */
export function calculatePureQuality(externalRatings: ExternalRatings): {
  avgRating: number;
  totalVotes: number;
} {
  const ratings: number[] = [];
  let totalVotes = 0;

  if (externalRatings.imdb?.rating) {
    ratings.push(externalRatings.imdb.rating);
    totalVotes += externalRatings.imdb.voteCount ?? 0;
  }
  if (externalRatings.tmdb?.rating) {
    ratings.push(externalRatings.tmdb.rating);
    totalVotes += externalRatings.tmdb.voteCount ?? 0;
  }
  if (externalRatings.trakt?.rating) {
    ratings.push(externalRatings.trakt.rating);
    totalVotes += externalRatings.trakt.voteCount ?? 0;
  }

  if (ratings.length === 0) {
    return { avgRating: 0, totalVotes: 0 };
  }

  const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { avgRating, totalVotes };
}

/**
 * Checks if media qualifies for HIT badge based on pure quality.
 * HIT = avgRating >= 7.5 AND totalVotes >= 1000
 */
export function isHitQuality(externalRatings: ExternalRatings): boolean {
  const { avgRating, totalVotes } = calculatePureQuality(externalRatings);
  return avgRating >= HIT_AVG_RATING_THRESHOLD && totalVotes >= HIT_MIN_VOTES_THRESHOLD;
}
