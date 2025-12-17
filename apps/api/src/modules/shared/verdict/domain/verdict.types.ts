/**
 * Verdict Engine - Domain Types
 *
 * Core types for the verdict system that evaluates media quality
 * and provides user-facing recommendations.
 */

/**
 * Verdict type for UI styling.
 */
export type VerdictType = 'warning' | 'release' | 'quality' | 'popularity' | 'general';

/**
 * Hint key for CTA suggestions.
 */
export type VerdictHintKey =
  | 'newEpisodes'
  | 'afterAllEpisodes'
  | 'whenOnStreaming'
  | 'notifyNewEpisode'
  | 'general'
  | 'forLater'
  | 'notifyRelease'
  | 'decideToWatch';

/**
 * Rating source labels for context display.
 */
export const RATING_SOURCE = {
  IMDB: 'IMDb',
  TRAKT: 'Trakt',
  TMDB: 'TMDB',
} as const;

export type RatingSourceLabel = (typeof RATING_SOURCE)[keyof typeof RATING_SOURCE];

/**
 * External ratings from different sources.
 */
export interface ExternalRatings {
  imdb?: { rating: number; voteCount?: number | null } | null;
  trakt?: { rating: number; voteCount?: number | null } | null;
  tmdb?: { rating: number; voteCount?: number | null } | null;
}

/**
 * Aggregated rating data computed from external sources.
 */
export interface AggregatedRating {
  /** Median of all available ratings (most stable "truth of the crowd") */
  consensusRating: number | null;
  /** Difference between max and min ratings (indicator of disagreement) */
  spread: number;
  /** Total votes across all sources */
  totalVotes: number;
  /** Number of rating sources available */
  ratingsCount: number;
  /** Source with highest vote count (for context display) */
  primarySource: RatingSourceLabel;
}

/**
 * Base verdict structure returned by verdict services.
 */
export interface BaseVerdict<TMessageKey> {
  type: VerdictType;
  messageKey: TMessageKey;
  context?: string | null;
  hintKey: VerdictHintKey;
}
