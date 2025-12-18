/**
 * Show Verdict Service
 *
 * Generates smart verdicts for TV shows based on quality, status, and timing.
 * DNA Ratingo: "honesty before hype"
 */

import { Injectable } from '@nestjs/common';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { BADGE_KEY } from '../../cards/domain/card.constants';
import { ShowVerdictInput, ShowVerdict, ShowVerdictResult } from '../domain/show-verdict.types';
import {
  CONFIDENCE,
  RATING_THRESHOLDS,
  SPREAD_THRESHOLDS,
  TIME_WINDOWS,
  AGE_THRESHOLDS,
} from '../domain/verdict.constants';
import { aggregateRatings, formatRatingContext } from '../domain/rating-aggregator';

/**
 * Show Verdict Service
 *
 * Generates smart verdicts for TV shows based on quality, status, and timing.
 *
 * DNA Ratingo Architecture:
 * - verdict: answers "is it worth it?" (quality/warning)
 * - statusHint: explains "why now?" (timing/status) - NEVER standalone
 *
 * INVARIANT: Status hints (newSeason, seriesFinale) are NEVER shown without a quality verdict.
 */
@Injectable()
export class ShowVerdictService {
  /**
   * Computes verdict for a show.
   */
  compute(input: ShowVerdictInput): ShowVerdictResult {
    const { status, externalRatings, badgeKey, totalSeasons, lastAirDate, firstAirDate } = input;

    // Calculate content age in years
    const contentAgeYears = firstAirDate
      ? (Date.now() - new Date(firstAirDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
      : 0;
    const isOlderContent = contentAgeYears >= AGE_THRESHOLDS.OLDER_CONTENT_YEARS;
    const isClassic = contentAgeYears >= AGE_THRESHOLDS.CLASSIC_YEARS;

    // Aggregate ratings from all sources
    const { consensusRating, spread, totalVotes, ratingsCount, primarySource } =
      aggregateRatings(externalRatings);

    // Helper to format rating context
    const formatContext = (rating: number | null | undefined): string | null => {
      return formatRatingContext(rating, primarySource);
    };

    // Status flags
    const isCancelled = status === ShowStatus.CANCELED;
    const isEnded = status === ShowStatus.ENDED;
    const isReturning = status === ShowStatus.RETURNING_SERIES;

    // Confidence gates
    const hasConfidentRating = totalVotes >= CONFIDENCE.MIN_VOTES_FOR_CONFIDENCE;
    const hasAnyRatings = consensusRating !== null;

    // Spread threshold: high spread means "opinions diverge"
    // Rule A: spread == 1.0 with high votes (1000+) is also considered high spread
    const hasHighSpread =
      spread > SPREAD_THRESHOLDS.MAX_FOR_OPTIMISTIC ||
      (spread === SPREAD_THRESHOLDS.MAX_FOR_OPTIMISTIC &&
        totalVotes >= CONFIDENCE.MIN_VOTES_FOR_SPREAD_MATTERS);

    // Quality thresholds (based on consensusRating)
    const isPoorQuality = hasConfidentRating && (consensusRating ?? 10) < RATING_THRESHOLDS.POOR;
    const isBelowAverage =
      hasConfidentRating && (consensusRating ?? 10) < RATING_THRESHOLDS.BELOW_AVERAGE;
    const isMixedQuality = hasConfidentRating && (consensusRating ?? 10) < RATING_THRESHOLDS.MIXED;
    const isDecentQuality =
      hasConfidentRating &&
      (consensusRating ?? 0) >= RATING_THRESHOLDS.DECENT &&
      (consensusRating ?? 0) < RATING_THRESHOLDS.STRONG;
    const isGoodQuality = hasConfidentRating && (consensusRating ?? 0) >= RATING_THRESHOLDS.STRONG;
    const isCriticsLoved =
      (consensusRating ?? 0) >= RATING_THRESHOLDS.CRITICS_LOVED &&
      totalVotes >= CONFIDENCE.MIN_VOTES_FOR_CRITICS_LOVED &&
      !hasHighSpread;

    // Long running: 5+ seasons with at least decent quality
    const isLongRunning =
      (totalSeasons ?? 0) >= 5 &&
      !isCancelled &&
      (consensusRating ?? 0) >= RATING_THRESHOLDS.DECENT;

    // New season detection: lastAirDate within 14 days
    const hasRecentSeason = (() => {
      if (!lastAirDate || !isReturning) return false;
      const now = new Date();
      const diffMs = now.getTime() - new Date(lastAirDate).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= TIME_WINDOWS.NEW_SEASON_DAYS;
    })();

    // Helper to build result with optional status hint
    const buildResult = (verdict: ShowVerdict, isWarning: boolean): ShowVerdictResult => {
      // Status hints are NEVER shown with warnings
      if (isWarning) {
        return { verdict, statusHint: null };
      }

      // Add statusHint based on show status
      if (hasRecentSeason) {
        return { verdict, statusHint: { messageKey: 'newSeason' } };
      }
      // ended → statusHint for ALL ended shows (not just goodQuality)
      if (isEnded) {
        return { verdict, statusHint: { messageKey: 'seriesFinale' } };
      }

      return { verdict, statusHint: null };
    };

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 1: CANCELLED (highest warning)
    // ═══════════════════════════════════════════════════════════════

    if (isCancelled) {
      return buildResult(
        {
          type: 'warning',
          messageKey: 'cancelled',
          context: null,
          hintKey: 'decideToWatch',
        },
        true,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 2: QUALITY WARNINGS
    // ═══════════════════════════════════════════════════════════════

    if (isPoorQuality) {
      return buildResult(
        {
          type: 'warning',
          messageKey: 'poorRatings',
          context: formatContext(consensusRating),
          hintKey: 'decideToWatch',
        },
        true,
      );
    }

    if (isBelowAverage) {
      return buildResult(
        {
          type: 'warning',
          messageKey: 'belowAverage',
          context: formatContext(consensusRating),
          hintKey: 'decideToWatch',
        },
        true,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 3: HIGH SPREAD CHECK (opinions diverge)
    // ═══════════════════════════════════════════════════════════════

    if (hasHighSpread && ratingsCount >= 2) {
      if (hasConfidentRating) {
        // High votes + high spread = people genuinely disagree
        return buildResult(
          {
            type: 'general',
            messageKey: 'mixedReviews',
            context: formatContext(consensusRating),
            hintKey: 'decideToWatch',
          },
          false,
        );
      } else {
        // Low votes + high spread = too early to tell
        return buildResult(
          {
            type: 'general',
            messageKey: 'noConsensusYet',
            context: formatContext(consensusRating),
            hintKey: 'decideToWatch',
          },
          false,
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 4: QUALITY SIGNALS
    // ═══════════════════════════════════════════════════════════════

    // Trending Now - high current interest
    // For older content, use age-appropriate messaging
    if (badgeKey === BADGE_KEY.TRENDING || badgeKey === BADGE_KEY.HIT) {
      if (isClassic && isGoodQuality) {
        // 10+ years old with good ratings = timeless favorite
        return buildResult(
          {
            type: 'quality',
            messageKey: 'timelessFavorite',
            context: formatContext(consensusRating),
            hintKey: 'forLater',
          },
          false,
        );
      }
      if (isOlderContent) {
        // 3+ years old = steady interest, not "hype"
        return buildResult(
          {
            type: 'popularity',
            messageKey: 'steadyInterest',
            context: formatContext(consensusRating),
            hintKey: 'forLater',
          },
          false,
        );
      }
      // Recent content can use "trending now"
      return buildResult(
        {
          type: 'popularity',
          messageKey: 'trendingNow',
          context: null,
          hintKey: 'forLater',
        },
        false,
      );
    }

    // Critics Loved - high quality
    if (isCriticsLoved) {
      return buildResult(
        {
          type: 'quality',
          messageKey: 'criticsLoved',
          context: formatContext(consensusRating),
          hintKey: 'forLater',
        },
        false,
      );
    }

    // Strong Ratings - good quality (>= 7.0)
    if (isGoodQuality) {
      return buildResult(
        {
          type: 'quality',
          messageKey: 'strongRatings',
          context: formatContext(consensusRating),
          hintKey: 'forLater',
        },
        false,
      );
    }

    // Decent Ratings - okay quality (6.5 - 7.0)
    if (isDecentQuality) {
      return buildResult(
        {
          type: 'quality',
          messageKey: 'decentRatings',
          context: formatContext(consensusRating),
          hintKey: 'forLater',
        },
        false,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 5: LONG RUNNING (proven over time)
    // ═══════════════════════════════════════════════════════════════

    if (isLongRunning) {
      return buildResult(
        {
          type: 'quality',
          messageKey: 'longRunning',
          context: `${totalSeasons} сезонів`,
          hintKey: 'forLater',
        },
        false,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 6: POPULARITY
    // ═══════════════════════════════════════════════════════════════

    // Rising Hype - growing popularity
    // For older content, frame as "classic series" not "rising hype"
    if (badgeKey === BADGE_KEY.RISING) {
      if (isClassic && isGoodQuality) {
        return buildResult(
          {
            type: 'quality',
            messageKey: 'classicSeries',
            context: formatContext(consensusRating),
            hintKey: 'forLater',
          },
          false,
        );
      }
      if (isOlderContent) {
        return buildResult(
          {
            type: 'popularity',
            messageKey: 'steadyInterest',
            context: formatContext(consensusRating),
            hintKey: 'forLater',
          },
          false,
        );
      }
      return buildResult(
        {
          type: 'popularity',
          messageKey: 'risingHype',
          context: null,
          hintKey: 'decideToWatch',
        },
        false,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 7: EARLY REVIEWS
    // ═══════════════════════════════════════════════════════════════

    if (hasAnyRatings && !hasConfidentRating) {
      const isEarlyBadRating = (consensusRating ?? 10) < RATING_THRESHOLDS.BELOW_AVERAGE;

      if (isEarlyBadRating) {
        return buildResult(
          {
            type: 'warning',
            messageKey: 'belowAverage',
            context: formatContext(consensusRating),
            hintKey: 'decideToWatch',
          },
          true,
        );
      }

      return buildResult(
        {
          type: 'general',
          messageKey: 'earlyReviews',
          context: formatContext(consensusRating),
          hintKey: 'decideToWatch',
        },
        false,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIORITY 8: FALLBACKS
    // ═══════════════════════════════════════════════════════════════

    if (isMixedQuality) {
      return buildResult(
        {
          type: 'general',
          messageKey: 'mixedReviews',
          context: formatContext(consensusRating),
          hintKey: 'decideToWatch',
        },
        false,
      );
    }

    // Default fallback - no verdict
    return {
      verdict: {
        type: 'general',
        messageKey: null,
        context: null,
        hintKey: 'decideToWatch',
      },
      statusHint: null,
    };
  }
}

/**
 * Standalone function for backward compatibility.
 * Prefer using ShowVerdictService.compute() in new code.
 */
export function computeShowVerdict(input: ShowVerdictInput): ShowVerdictResult {
  const service = new ShowVerdictService();
  return service.compute(input);
}
