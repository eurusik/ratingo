/**
 * Movie Verdict - Domain Types
 *
 * Types for movie verdict computation.
 */

import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { RatingSourceLabel, BaseVerdict } from './verdict.types';
import type { PopularitySignal } from './popularity-signal';

/**
 * Message key for i18n lookup on client.
 */
export type MovieVerdictMessageKey =
  | 'upcomingHit'
  | 'justReleased'
  | 'nowStreaming'
  | 'criticsLoved'
  | 'trendingNow'
  | 'strongRatings'
  | 'decentRatings'
  | 'risingHype'
  | 'comingToStreaming'
  | 'mixedReviews'
  | 'belowAverage'
  | 'poorRatings'
  | 'earlyReviews'
  // Age-aware verdicts for older content
  | 'steadyInterest'
  | 'classicChoice'
  | 'timelessFavorite'
  | null;

/**
 * Input data for movie verdict computation.
 */
export interface MovieVerdictInput {
  releaseStatus?: ReleaseStatus | null;
  ratingoScore?: number | null;
  avgRating?: number | null;
  voteCount?: number | null;
  ratingSource?: RatingSourceLabel | null;
  /** Popularity signal (trending/hit/rising) */
  popularitySignal?: PopularitySignal;
  popularity?: number | null;
  /** Release date for age-aware verdicts */
  releaseDate?: Date | null;
}

/**
 * Verdict result returned to client.
 */
export type MovieVerdict = BaseVerdict<MovieVerdictMessageKey>;
