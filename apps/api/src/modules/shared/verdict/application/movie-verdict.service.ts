/**
 * Movie Verdict Service
 *
 * Generates smart verdicts for movies based on quality and release data.
 * DNA Ratingo: "honesty before hype"
 */

import { Injectable } from '@nestjs/common';
import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { BADGE_KEY } from '../../cards/domain/card.constants';
import { MovieVerdictInput, MovieVerdict } from '../domain/movie-verdict.types';
import { RATING_SOURCE } from '../domain/verdict.types';
import {
  CONFIDENCE,
  RATING_THRESHOLDS,
  POPULARITY_THRESHOLDS,
  AGE_THRESHOLDS,
} from '../domain/verdict.constants';
import { formatRatingContext } from '../domain/rating-aggregator';

/**
 * Movie Verdict Service
 *
 * Generates smart verdicts for movies based on quality and release data.
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
 */
@Injectable()
export class MovieVerdictService {
  /**
   * Computes verdict for a movie.
   */
  compute(input: MovieVerdictInput): MovieVerdict {
    const { releaseStatus, avgRating, voteCount, ratingSource, badgeKey, popularity, releaseDate } =
      input;

    // Calculate content age in years
    const contentAgeYears = releaseDate
      ? (Date.now() - new Date(releaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
      : 0;
    const isOlderContent = contentAgeYears >= AGE_THRESHOLDS.OLDER_CONTENT_YEARS;
    const isClassic = contentAgeYears >= AGE_THRESHOLDS.CLASSIC_YEARS;

    // Helper to format rating context with correct source label
    const formatContext = (rating: number | null | undefined): string | null => {
      return formatRatingContext(rating, ratingSource ?? RATING_SOURCE.IMDB);
    };

    // Release status flags
    const isUpcomingMovie = releaseStatus === ReleaseStatus.UPCOMING;
    const isInTheaters = releaseStatus === ReleaseStatus.IN_THEATERS;
    const isNewOnStreaming = releaseStatus === ReleaseStatus.NEW_ON_STREAMING;

    // Confidence gate: enough votes to trust the rating
    const hasConfidentRating = (voteCount ?? 0) >= CONFIDENCE.MIN_VOTES_FOR_CONFIDENCE;
    const hasAnyRatings = avgRating !== null && avgRating !== undefined;

    // Quality thresholds (only based on avgRating, NOT ratingoScore)
    const isPoorQuality = hasConfidentRating && (avgRating ?? 10) < RATING_THRESHOLDS.POOR;
    const isBelowAverage =
      hasConfidentRating && (avgRating ?? 10) < RATING_THRESHOLDS.BELOW_AVERAGE;
    const isMixedQuality = hasConfidentRating && (avgRating ?? 10) < RATING_THRESHOLDS.MIXED;
    const isDecentQuality =
      hasConfidentRating &&
      (avgRating ?? 0) >= RATING_THRESHOLDS.DECENT &&
      (avgRating ?? 0) < RATING_THRESHOLDS.STRONG;
    const isGoodQuality = hasConfidentRating && (avgRating ?? 0) >= RATING_THRESHOLDS.STRONG;
    const isCriticsLoved =
      (avgRating ?? 0) >= RATING_THRESHOLDS.CRITICS_LOVED &&
      (voteCount ?? 0) >= CONFIDENCE.MIN_VOTES_FOR_CRITICS_LOVED;

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 1: QUALITY WARNINGS (always show if quality is bad)
    // ═══════════════════════════════════════════════════════════════

    if (isPoorQuality) {
      return {
        type: 'warning',
        messageKey: 'poorRatings',
        context: formatContext(avgRating),
        hintKey: 'decideToWatch',
      };
    }

    if (isBelowAverage) {
      return {
        type: 'warning',
        messageKey: 'belowAverage',
        context: formatContext(avgRating),
        hintKey: 'decideToWatch',
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 2: TIMING FOR UPCOMING/IN THEATERS (no ratings yet)
    // ═══════════════════════════════════════════════════════════════

    if (isUpcomingMovie && (popularity ?? 0) > POPULARITY_THRESHOLDS.RISING) {
      return {
        type: 'release',
        messageKey: 'upcomingHit',
        context: null,
        hintKey: 'notifyRelease',
      };
    }

    // In Theaters - only show if no confident ratings yet
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
    // ═══════════════════════════════════════════════════════════════

    // Trending Now - high current interest
    // For older content, use age-appropriate messaging
    if (badgeKey === BADGE_KEY.TRENDING || badgeKey === BADGE_KEY.HIT) {
      if (isClassic && isGoodQuality) {
        // 10+ years old with good ratings = timeless favorite
        return {
          type: 'quality',
          messageKey: 'timelessFavorite',
          context: formatContext(avgRating),
          hintKey: 'forLater',
        };
      }
      if (isOlderContent) {
        // 3+ years old = steady interest, not "hype"
        return {
          type: 'popularity',
          messageKey: 'steadyInterest',
          context: formatContext(avgRating),
          hintKey: 'forLater',
        };
      }
      // Recent content can use "trending now"
      return {
        type: 'popularity',
        messageKey: 'trendingNow',
        context: null,
        hintKey: 'forLater',
      };
    }

    // Critics Loved - high quality
    if (isCriticsLoved) {
      return {
        type: 'quality',
        messageKey: 'criticsLoved',
        context: formatContext(avgRating),
        hintKey: 'forLater',
      };
    }

    // Strong Ratings - good quality (>= 7.0)
    if (isGoodQuality) {
      return {
        type: 'quality',
        messageKey: 'strongRatings',
        context: formatContext(avgRating),
        hintKey: 'forLater',
      };
    }

    // Decent Ratings - okay quality (6.5 - 7.0)
    if (isDecentQuality) {
      return {
        type: 'quality',
        messageKey: 'decentRatings',
        context: formatContext(avgRating),
        hintKey: 'forLater',
      };
    }

    // Rising Hype - growing popularity
    // For older content, frame as "classic choice" not "rising hype"
    if (badgeKey === BADGE_KEY.RISING) {
      if (isClassic && isGoodQuality) {
        return {
          type: 'quality',
          messageKey: 'classicChoice',
          context: formatContext(avgRating),
          hintKey: 'forLater',
        };
      }
      if (isOlderContent) {
        return {
          type: 'popularity',
          messageKey: 'steadyInterest',
          context: formatContext(avgRating),
          hintKey: 'forLater',
        };
      }
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

    if (isNewOnStreaming && !hasAnyRatings) {
      return {
        type: 'release',
        messageKey: 'nowStreaming',
        context: null,
        hintKey: 'forLater',
      };
    }

    // Early Reviews - ratings exist but not enough votes for confidence
    if (hasAnyRatings && !hasConfidentRating) {
      return {
        type: 'general',
        messageKey: 'earlyReviews',
        context: formatContext(avgRating),
        hintKey: 'decideToWatch',
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 5: FALLBACKS
    // ═══════════════════════════════════════════════════════════════

    if (isMixedQuality) {
      return {
        type: 'general',
        messageKey: 'mixedReviews',
        context: formatContext(avgRating),
        hintKey: 'decideToWatch',
      };
    }

    // Default fallback - no verdict
    return {
      type: 'general',
      messageKey: null,
      context: null,
      hintKey: 'decideToWatch',
    };
  }
}

/**
 * Standalone function for backward compatibility.
 * Prefer using MovieVerdictService.compute() in new code.
 */
export function computeMovieVerdict(input: MovieVerdictInput): MovieVerdict {
  const service = new MovieVerdictService();
  return service.compute(input);
}
