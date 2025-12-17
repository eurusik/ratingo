import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { BADGE_KEY, type BadgeKey } from '../../../shared/cards/domain/card.constants';
import {
  VerdictType,
  VerdictHintKey,
  RATING_SOURCE,
  RatingSourceLabel,
} from './movie-verdict.utils';

/**
 * Quality verdict message keys - answer "is it worth it?"
 */
export type ShowQualityVerdictKey =
  | 'cancelled'
  | 'poorRatings'
  | 'belowAverage'
  | 'criticsLoved'
  | 'strongRatings'
  | 'decentRatings'
  | 'longRunning'
  | 'trendingNow'
  | 'risingHype'
  | 'earlyReviews'
  | 'mixedReviews'
  | 'noConsensusYet' // ratings diverge but not enough votes to be sure
  | null;

/**
 * Status hint message keys - explain "why now?"
 */
export type ShowStatusHintKey = 'newSeason' | 'seriesFinale' | null;

/**
 * External ratings from different sources
 */
export interface ExternalRatingsInput {
  imdb?: { rating: number; voteCount?: number | null } | null;
  trakt?: { rating: number; voteCount?: number | null } | null;
  tmdb?: { rating: number; voteCount?: number | null } | null;
}

export interface ShowVerdictInput {
  status?: ShowStatus | null;
  externalRatings?: ExternalRatingsInput | null;
  badgeKey?: BadgeKey;
  popularity?: number | null;
  totalSeasons?: number | null;
  lastAirDate?: Date | null;
}

/**
 * Main verdict - answers "is it worth it?"
 */
export interface ShowVerdict {
  type: VerdictType;
  messageKey: ShowQualityVerdictKey;
  context?: string | null;
  hintKey: VerdictHintKey;
}

/**
 * Status hint - explains "why now?" (secondary, optional)
 */
export interface ShowStatusHint {
  messageKey: ShowStatusHintKey;
}

/**
 * Full verdict result with optional status hint.
 */
export interface ShowVerdictResult {
  verdict: ShowVerdict;
  statusHint: ShowStatusHint | null;
}

/**
 * Computes consensus rating (median) and spread from external ratings.
 * DNA Ratingo: median is the most stable "truth of the crowd".
 */
function computeConsensusRating(ratings: ExternalRatingsInput | null | undefined): {
  consensusRating: number | null;
  spread: number;
  totalVotes: number;
  ratingsCount: number;
  bestSource: RatingSourceLabel | null;
} {
  if (!ratings) {
    return { consensusRating: null, spread: 0, totalVotes: 0, ratingsCount: 0, bestSource: null };
  }

  const values: number[] = [];
  const sources: { rating: number; votes: number; source: RatingSourceLabel }[] = [];

  if (ratings.imdb?.rating) {
    values.push(ratings.imdb.rating);
    sources.push({
      rating: ratings.imdb.rating,
      votes: ratings.imdb.voteCount ?? 0,
      source: RATING_SOURCE.IMDB,
    });
  }
  if (ratings.trakt?.rating) {
    values.push(ratings.trakt.rating);
    sources.push({
      rating: ratings.trakt.rating,
      votes: ratings.trakt.voteCount ?? 0,
      source: RATING_SOURCE.TRAKT,
    });
  }
  if (ratings.tmdb?.rating) {
    values.push(ratings.tmdb.rating);
    sources.push({
      rating: ratings.tmdb.rating,
      votes: ratings.tmdb.voteCount ?? 0,
      source: RATING_SOURCE.TMDB,
    });
  }

  if (values.length === 0) {
    return { consensusRating: null, spread: 0, totalVotes: 0, ratingsCount: 0, bestSource: null };
  }

  // Sort for median calculation
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const consensusRating =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const spread = Math.max(...values) - Math.min(...values);
  const totalVotes = sources.reduce((sum, s) => sum + s.votes, 0);

  // Best source = highest votes (for context display)
  const bestSource =
    sources.length > 0 ? sources.sort((a, b) => b.votes - a.votes)[0].source : null;

  return { consensusRating, spread, totalVotes, ratingsCount: values.length, bestSource };
}

/**
 * Generates a smart verdict for shows based on quality, status, and timing.
 *
 * DNA Ratingo Architecture:
 * - verdict: answers "is it worth it?" (quality/warning)
 * - statusHint: explains "why now?" (timing/status) - NEVER standalone
 *
 * INVARIANT: Status hints (newSeason, seriesFinale) are NEVER shown without a quality verdict.
 *
 * Rating logic:
 * - consensusRating = median of all available ratings (IMDb, Trakt, TMDB)
 * - spread = max - min rating (high spread = "opinions diverge")
 * - Optimistic verdicts blocked if spread > 1.0
 *
 * Verdict hierarchy:
 * 1. CANCELLED - highest warning
 * 2. POOR/BELOW AVERAGE - quality warnings
 * 3. QUALITY - critics loved/strong/decent/long running
 * 4. POPULARITY - trending/rising
 * 5. EARLY REVIEWS / MIXED / null - fallbacks
 *
 * @param show - Show data for verdict generation
 * @returns ShowVerdictResult with verdict and optional statusHint
 */
export function computeShowVerdict(show: ShowVerdictInput): ShowVerdictResult {
  const { status, externalRatings, badgeKey, totalSeasons, lastAirDate } = show;

  // Compute consensus rating from all sources
  const { consensusRating, spread, totalVotes, ratingsCount, bestSource } =
    computeConsensusRating(externalRatings);

  // Helper to format rating context
  const formatRatingContext = (rating: number | null | undefined): string | null => {
    if (rating === null || rating === undefined) return null;
    const source = bestSource ?? RATING_SOURCE.IMDB;
    return `${source}: ${rating.toFixed(1)}`;
  };

  // Status flags
  const isCancelled = status === ShowStatus.CANCELED;
  const isEnded = status === ShowStatus.ENDED;
  const isReturning = status === ShowStatus.RETURNING_SERIES;

  // Confidence gates
  const MIN_VOTES_FOR_CONFIDENCE = 200;
  const MIN_VOTES_FOR_CRITICS_LOVED = 1000;
  const hasConfidentRating = totalVotes >= MIN_VOTES_FOR_CONFIDENCE;
  const hasAnyRatings = consensusRating !== null;

  // Spread threshold: high spread means "opinions diverge"
  // Rule A: spread == 1.0 with high votes (1000+) is also considered high spread
  const MAX_SPREAD_FOR_OPTIMISTIC = 1.0;
  const MIN_VOTES_FOR_SPREAD_MATTERS = 1000;
  const hasHighSpread =
    spread > MAX_SPREAD_FOR_OPTIMISTIC ||
    (spread === MAX_SPREAD_FOR_OPTIMISTIC && totalVotes >= MIN_VOTES_FOR_SPREAD_MATTERS);

  // Quality thresholds (based on consensusRating)
  const isPoorQuality = hasConfidentRating && (consensusRating ?? 10) < 5.5;
  const isBelowAverage = hasConfidentRating && (consensusRating ?? 10) < 6;
  const isMixedQuality = hasConfidentRating && (consensusRating ?? 10) < 6.5;
  const isDecentQuality =
    hasConfidentRating && (consensusRating ?? 0) >= 6.5 && (consensusRating ?? 0) < 7.0;
  const isGoodQuality = hasConfidentRating && (consensusRating ?? 0) >= 7.0;
  const isCriticsLoved =
    (consensusRating ?? 0) >= 7.5 && totalVotes >= MIN_VOTES_FOR_CRITICS_LOVED && !hasHighSpread;

  // Long running: 5+ seasons with at least decent quality
  const isLongRunning = (totalSeasons ?? 0) >= 5 && !isCancelled && (consensusRating ?? 0) >= 6.5;

  // New season detection: lastAirDate within 14 days
  const NEW_SEASON_DAYS = 14;
  const hasRecentSeason = (() => {
    if (!lastAirDate || !isReturning) return false;
    const now = new Date();
    const diffMs = now.getTime() - new Date(lastAirDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= NEW_SEASON_DAYS;
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
    if (isEnded && isGoodQuality) {
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
        context: formatRatingContext(consensusRating),
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
        context: formatRatingContext(consensusRating),
        hintKey: 'decideToWatch',
      },
      true,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 3: HIGH SPREAD CHECK (opinions diverge)
  // ═══════════════════════════════════════════════════════════════

  // If spread is high, ratings diverge significantly
  // Rule B: Differentiate between "mixedReviews" (confident) and "noConsensusYet" (not confident)
  if (hasHighSpread && ratingsCount >= 2) {
    if (hasConfidentRating) {
      // High votes + high spread = people genuinely disagree
      return buildResult(
        {
          type: 'general',
          messageKey: 'mixedReviews',
          context: formatRatingContext(consensusRating),
          hintKey: 'decideToWatch',
        },
        false,
      );
    } else {
      // Low votes + high spread = too early to tell, ratings still forming
      return buildResult(
        {
          type: 'general',
          messageKey: 'noConsensusYet',
          context: formatRatingContext(consensusRating),
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
  if (badgeKey === BADGE_KEY.TRENDING || badgeKey === BADGE_KEY.HIT) {
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

  // Critics Loved - high quality (consensusRating >= 7.5 + enough votes + low spread)
  if (isCriticsLoved) {
    return buildResult(
      {
        type: 'quality',
        messageKey: 'criticsLoved',
        context: formatRatingContext(consensusRating),
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
        context: formatRatingContext(consensusRating),
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
        context: formatRatingContext(consensusRating),
        hintKey: 'forLater',
      },
      false,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 4: LONG RUNNING (proven over time)
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
  // PRIORITY 5: POPULARITY
  // ═══════════════════════════════════════════════════════════════

  if (badgeKey === BADGE_KEY.RISING) {
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
  // PRIORITY 6: EARLY REVIEWS (only if rating is not clearly bad)
  // ═══════════════════════════════════════════════════════════════

  // If we have ratings but not enough votes for confidence:
  // - If rating is low (< 6.0), show warning instead of earlyReviews
  // - If rating is ok (>= 6.0), show earlyReviews
  if (hasAnyRatings && !hasConfidentRating) {
    const isEarlyBadRating = (consensusRating ?? 10) < 6.0;

    if (isEarlyBadRating) {
      // Even with few votes, low rating is a warning signal
      return buildResult(
        {
          type: 'warning',
          messageKey: 'belowAverage',
          context: formatRatingContext(consensusRating),
          hintKey: 'decideToWatch',
        },
        true, // isWarning = true, so no statusHint
      );
    }

    return buildResult(
      {
        type: 'general',
        messageKey: 'earlyReviews',
        context: formatRatingContext(consensusRating),
        hintKey: 'decideToWatch',
      },
      false,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 7: FALLBACKS
  // ═══════════════════════════════════════════════════════════════

  if (isMixedQuality) {
    return buildResult(
      {
        type: 'general',
        messageKey: 'mixedReviews',
        context: formatRatingContext(consensusRating),
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
