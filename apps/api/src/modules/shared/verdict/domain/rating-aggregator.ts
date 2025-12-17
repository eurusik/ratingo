/**
 * Rating Aggregator - Domain Service
 *
 * Computes consensus rating (median) and spread from external ratings.
 * DNA Ratingo: "honesty before hype" - median is the most stable "truth of the crowd".
 */

import {
  ExternalRatings,
  AggregatedRating,
  RATING_SOURCE,
  RatingSourceLabel,
} from './verdict.types';

/**
 * Computes aggregated rating data from external sources.
 *
 * @param ratings - External ratings from IMDb, Trakt, TMDB
 * @returns Aggregated rating with consensus, spread, and metadata
 */
export function aggregateRatings(ratings: ExternalRatings | null | undefined): AggregatedRating {
  if (!ratings) {
    return {
      consensusRating: null,
      spread: 0,
      totalVotes: 0,
      ratingsCount: 0,
      primarySource: RATING_SOURCE.IMDB,
    };
  }

  const ratingValues: number[] = [];
  const sources: { source: RatingSourceLabel; votes: number }[] = [];

  // Collect all available ratings
  if (ratings.imdb?.rating !== undefined && ratings.imdb.rating !== null) {
    ratingValues.push(ratings.imdb.rating);
    sources.push({
      source: RATING_SOURCE.IMDB,
      votes: ratings.imdb.voteCount ?? 0,
    });
  }
  if (ratings.trakt?.rating !== undefined && ratings.trakt.rating !== null) {
    ratingValues.push(ratings.trakt.rating);
    sources.push({
      source: RATING_SOURCE.TRAKT,
      votes: ratings.trakt.voteCount ?? 0,
    });
  }
  if (ratings.tmdb?.rating !== undefined && ratings.tmdb.rating !== null) {
    ratingValues.push(ratings.tmdb.rating);
    sources.push({
      source: RATING_SOURCE.TMDB,
      votes: ratings.tmdb.voteCount ?? 0,
    });
  }

  if (ratingValues.length === 0) {
    return {
      consensusRating: null,
      spread: 0,
      totalVotes: 0,
      ratingsCount: 0,
      primarySource: RATING_SOURCE.IMDB,
    };
  }

  // Calculate median (consensus rating)
  const sorted = [...ratingValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const consensusRating =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Calculate spread (max - min)
  const spread = Math.max(...ratingValues) - Math.min(...ratingValues);

  // Calculate total votes
  const totalVotes = sources.reduce((sum, s) => sum + s.votes, 0);

  // Find primary source (highest vote count)
  const primarySource =
    sources.length > 0
      ? sources.reduce((best, curr) => (curr.votes > best.votes ? curr : best)).source
      : RATING_SOURCE.IMDB;

  return {
    consensusRating,
    spread,
    totalVotes,
    ratingsCount: ratingValues.length,
    primarySource,
  };
}

/**
 * Formats rating context string for display.
 *
 * @param rating - Rating value
 * @param source - Rating source label
 * @returns Formatted string like "IMDb: 7.5"
 */
export function formatRatingContext(
  rating: number | null | undefined,
  source: RatingSourceLabel = RATING_SOURCE.IMDB,
): string | null {
  if (rating === null || rating === undefined) return null;
  return `${source}: ${rating.toFixed(1)}`;
}
