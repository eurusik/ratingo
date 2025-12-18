/**
 * Verdict Engine - Domain Constants
 *
 * Thresholds and rules for verdict computation.
 * DNA Ratingo: "honesty before hype"
 */

/**
 * Confidence gates - minimum votes for reliable verdicts.
 */
export const CONFIDENCE = {
  /** Minimum votes for a confident rating verdict */
  MIN_VOTES_FOR_CONFIDENCE: 200,
  /** Minimum votes for "critics loved" verdict */
  MIN_VOTES_FOR_CRITICS_LOVED: 1000,
  /** Minimum votes where spread == 1.0 matters */
  MIN_VOTES_FOR_SPREAD_MATTERS: 1000,
} as const;

/**
 * Rating thresholds for quality verdicts.
 */
export const RATING_THRESHOLDS = {
  /** Below this = poorRatings (warning) */
  POOR: 5.5,
  /** Below this = belowAverage (warning) */
  BELOW_AVERAGE: 6.0,
  /** Below this = mixedReviews */
  MIXED: 6.5,
  /** At or above this = decentRatings */
  DECENT: 6.5,
  /** At or above this = strongRatings */
  STRONG: 7.0,
  /** At or above this = criticsLoved (with vote threshold) */
  CRITICS_LOVED: 7.5,
} as const;

/**
 * Spread thresholds for rating disagreement.
 */
export const SPREAD_THRESHOLDS = {
  /** Maximum spread for optimistic verdicts */
  MAX_FOR_OPTIMISTIC: 1.0,
} as const;

/**
 * Popularity thresholds.
 */
export const POPULARITY_THRESHOLDS = {
  /** Minimum for trending/hype verdicts */
  TRENDING: 70,
  /** Minimum for rising hype */
  RISING: 50,
} as const;

/**
 * Time windows for status hints.
 */
export const TIME_WINDOWS = {
  /** Days to consider "new season" */
  NEW_SEASON_DAYS: 14,
  /** Days to consider "just released" */
  JUST_RELEASED_DAYS: 30,
} as const;

/**
 * Age thresholds for context-aware verdicts.
 * Content older than these thresholds gets different messaging.
 */
export const AGE_THRESHOLDS = {
  /** Years after which content is considered "older" (no hype language) */
  OLDER_CONTENT_YEARS: 3,
  /** Years after which content is considered a "classic" */
  CLASSIC_YEARS: 10,
} as const;
