import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { BADGE_KEY, type BadgeKey } from '../../../shared/cards/domain/card.constants';

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
  | null;

/**
 * Rating source labels for context display.
 */
export const RATING_SOURCE = {
  IMDB: 'IMDb',
  TRAKT: 'Trakt',
  TMDB: 'TMDB',
} as const;

export type RatingSourceLabel = (typeof RATING_SOURCE)[keyof typeof RATING_SOURCE];

export interface MovieVerdictInput {
  releaseStatus?: ReleaseStatus | null;
  ratingoScore?: number | null;
  avgRating?: number | null;
  voteCount?: number | null;
  ratingSource?: RatingSourceLabel | null;
  badgeKey?: BadgeKey;
  popularity?: number | null;
}

/**
 * Verdict result returned to client.
 */
export interface MovieVerdict {
  type: VerdictType;
  messageKey: MovieVerdictMessageKey;
  context?: string | null;
  hintKey: VerdictHintKey;
}

/**
 * Generates a smart verdict for movies based on quality and release data.
 *
 * Verdict hierarchy (do not change order without product review):
 * 1. WARNINGS - quality below threshold, always shown (honesty > hype)
 * 2. TIMING - upcoming/in_theaters only (no ratings yet)
 * 3. QUALITY - critics loved/strong ratings (has data to evaluate)
 * 4. NEW ON STREAMING - fallback context, not a recommendation
 * 5. FALLBACKS - mixed/default when no clear signal
 *
 * Key rule: new_on_streaming movies already went through theaters
 * and have ratings. Quality > timing for streaming releases.
 *
 * @param movie - Movie data for verdict generation
 * @returns Verdict with type, message key, context, and hint
 */
export function computeMovieVerdict(movie: MovieVerdictInput): MovieVerdict {
  const { releaseStatus, ratingoScore, avgRating, voteCount, ratingSource, badgeKey, popularity } =
    movie;

  // Helper to format rating context with correct source label
  const formatRatingContext = (rating: number | null | undefined): string | null => {
    if (rating === null || rating === undefined) return null;
    const source = ratingSource ?? 'IMDb';
    return `${source}: ${rating.toFixed(1)}`;
  };

  // Release status flags
  const isUpcomingMovie = releaseStatus === ReleaseStatus.UPCOMING;
  const isInTheaters = releaseStatus === ReleaseStatus.IN_THEATERS;
  const isNewOnStreaming = releaseStatus === ReleaseStatus.NEW_ON_STREAMING;

  // Confidence gate: enough votes to trust the rating
  const MIN_VOTES_FOR_CONFIDENCE = 200;
  const MIN_VOTES_FOR_CRITICS_LOVED = 1000;
  const hasConfidentRating = (voteCount ?? 0) >= MIN_VOTES_FOR_CONFIDENCE;
  const hasAnyRatings = avgRating !== null && avgRating !== undefined;

  // Quality thresholds (only based on avgRating, NOT ratingoScore)
  // ratingoScore is for trending/ranking, not for quality verdicts
  const isPoorQuality = hasConfidentRating && (avgRating ?? 10) < 5.5;
  const isBelowAverage = hasConfidentRating && (avgRating ?? 10) < 6;
  const isMixedQuality = hasConfidentRating && (avgRating ?? 10) < 6.5;
  const isDecentQuality = hasConfidentRating && (avgRating ?? 0) >= 6.5 && (avgRating ?? 0) < 7.0;
  const isGoodQuality = hasConfidentRating && (avgRating ?? 0) >= 7.0;
  const isCriticsLoved = (avgRating ?? 0) >= 7.5 && (voteCount ?? 0) >= MIN_VOTES_FOR_CRITICS_LOVED;

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 1: QUALITY WARNINGS (always show if quality is bad)
  // ═══════════════════════════════════════════════════════════════

  // 1. Poor Ratings - very low scores (show regardless of timing)
  if (isPoorQuality) {
    return {
      type: 'warning',
      messageKey: 'poorRatings',
      context: formatRatingContext(avgRating),
      hintKey: 'decideToWatch',
    };
  }

  // 2. Below Average - mediocre scores (show regardless of timing)
  if (isBelowAverage) {
    return {
      type: 'warning',
      messageKey: 'belowAverage',
      context: formatRatingContext(avgRating),
      hintKey: 'decideToWatch',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 2: TIMING FOR UPCOMING/IN THEATERS (no ratings yet)
  // ═══════════════════════════════════════════════════════════════

  // 3. Upcoming Hit - anticipated release with high popularity
  if (isUpcomingMovie && (popularity ?? 0) > 50) {
    return {
      type: 'release',
      messageKey: 'upcomingHit',
      context: null,
      hintKey: 'notifyRelease',
    };
  }

  // 4. In Theaters - only show if no confident ratings yet
  // If we have confident ratings, quality verdict is more valuable than "it's in theaters"
  if (isInTheaters && !hasConfidentRating) {
    return {
      type: 'release',
      messageKey: 'justReleased',
      context: null,
      hintKey: 'forLater',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 3: QUALITY SIGNALS (for movies with ratings)
  // For new_on_streaming - quality is more important than timing
  // ═══════════════════════════════════════════════════════════════

  // 5. Trending Now - high current interest
  if (badgeKey === BADGE_KEY.TRENDING || badgeKey === BADGE_KEY.HIT) {
    return {
      type: 'popularity',
      messageKey: 'trendingNow',
      context: null,
      hintKey: 'forLater',
    };
  }

  // 6. Critics Loved - high quality (avgRating >= 7.5 + enough votes)
  if (isCriticsLoved) {
    return {
      type: 'quality',
      messageKey: 'criticsLoved',
      context: formatRatingContext(avgRating),
      hintKey: 'forLater',
    };
  }

  // 7. Strong Ratings - good quality (>= 7.0)
  if (isGoodQuality) {
    return {
      type: 'quality',
      messageKey: 'strongRatings',
      context: formatRatingContext(avgRating),
      hintKey: 'forLater',
    };
  }

  // 8. Decent Ratings - okay quality (6.5 - 7.0)
  if (isDecentQuality) {
    return {
      type: 'quality',
      messageKey: 'decentRatings',
      context: formatRatingContext(avgRating),
      hintKey: 'forLater',
    };
  }

  // 9. Rising Hype - growing popularity
  if (badgeKey === BADGE_KEY.RISING) {
    return {
      type: 'popularity',
      messageKey: 'risingHype',
      context: null,
      hintKey: 'decideToWatch',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 4: NEW ON STREAMING (only if NO ratings exist yet)
  // ═══════════════════════════════════════════════════════════════

  // 9. Now Streaming - ONLY when there are no ratings at all
  // If ratings exist (even without confidence), this is not useful info
  if (isNewOnStreaming && !hasAnyRatings) {
    return {
      type: 'release',
      messageKey: 'nowStreaming',
      context: null,
      hintKey: 'forLater',
    };
  }

  // 10. Early Reviews - ratings exist but not enough votes for confidence
  if (hasAnyRatings && !hasConfidentRating) {
    return {
      type: 'general',
      messageKey: 'earlyReviews',
      context: formatRatingContext(avgRating),
      hintKey: 'decideToWatch',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 5: FALLBACKS
  // ═══════════════════════════════════════════════════════════════

  // 10. Mixed Reviews - average scores
  if (isMixedQuality) {
    return {
      type: 'general',
      messageKey: 'mixedReviews',
      context: formatRatingContext(avgRating),
      hintKey: 'decideToWatch',
    };
  }

  // 11. Default fallback - no verdict
  return {
    type: 'general',
    messageKey: null,
    context: null,
    hintKey: 'decideToWatch',
  };
}
