import { Injectable, Inject } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { MS_PER_DAY } from '../../../common/constants';
import scoreConfig from '../../../config/score.config';

// Rating scale constants
const RATING_SCALE_MAX = 10;
const PERCENT_SCALE = 100;
const NEUTRAL_RATING_DEFAULT = 5.0;

/**
 * Neutral confidence when no vote data available.
 * 0.5 = "we don't know" — neither good nor bad signal.
 * Combined with NEUTRAL_RATING_DEFAULT gives true neutral score.
 */
const NEUTRAL_CONFIDENCE_DEFAULT = 0.5;

/**
 * Source-specific vote thresholds for confidence calculation.
 * These represent votes needed for ~63% confidence (1 - 1/e).
 * IMDb has much higher volume than Trakt, so thresholds differ.
 */
const IMDB_CONFIDENCE_K = 1000;
const TRAKT_CONFIDENCE_K = 300;

/**
 * Input data for score calculation.
 */
export interface ScoreInput {
  // Popularity metrics
  /** TMDB popularity score (0-1000+, volatile but responsive) */
  tmdbPopularity: number;
  /** Trakt all-time watchers from /stats endpoint (stable, primary popularity signal) */
  traktTotalWatchers: number;
  /** Trakt live watchers from /watching endpoint (optional bonus, volatile) */
  traktLiveWatchers?: number | null;

  // Ratings (0-10 scale, except MC/RT which are 0-100)
  imdbRating?: number | null;
  traktRating?: number | null;
  metacriticRating?: number | null; // 0-100
  rottenTomatoesRating?: number | null; // 0-100

  // Vote counts
  imdbVotes?: number | null;
  traktVotes?: number | null;

  // Release info
  releaseDate?: Date | null;
  lastAirDate?: Date | null;
}

/**
 * Output scores from calculation.
 */
export interface ScoreOutput {
  ratingoScore: number; // Main composite score (0-100)
  qualityScore: number; // Rating-based component (0-100)
  popularityScore: number; // Popularity-based component (0-100)
  freshnessScore: number; // Time-based component (0-100)
  avgRating: number; // Pure weighted average rating (0-10 scale)
  totalVotes: number; // Total vote count (IMDb + Trakt)
}

/**
 * Rating source for weighted average calculation.
 */
interface RatingSource {
  value: number | null | undefined;
  weight: number;
}

/**
 * Service for calculating Ratingo Score.
 *
 * The Ratingo Score is a composite metric that combines:
 * - Popularity (TMDB + Trakt watchers) - 40%
 * - Quality (weighted average of IMDb, Trakt, MC, RT) - 40%
 * - Freshness (exponential decay with floor) - 20%
 */
@Injectable()
export class ScoreCalculatorService {
  constructor(
    @Inject(scoreConfig.KEY)
    private readonly config: ConfigType<typeof scoreConfig>,
  ) {}

  /**
   * Calculates all score components for a media item.
   *
   * @param {ScoreInput} input - Media data for score calculation
   * @returns {ScoreOutput} Calculated scores
   */
  calculate(input: ScoreInput): ScoreOutput {
    const { weights, normalization, votePenalty, liveWatchersBonus } = this.config;

    // === NORMALIZE ALL VALUES TO [0, 1] USING LOG SCALE ===

    // TMDB popularity: log normalization for smoother distribution
    const tmdbPopularityNorm = this.clamp(
      Math.log1p(input.tmdbPopularity) / Math.log1p(normalization.tmdbPopularityMax),
      0,
      1,
    );

    // Trakt total watchers: log normalization (stable, all-time metric)
    const traktTotalWatchersNorm = this.clamp(
      Math.log1p(input.traktTotalWatchers) / Math.log1p(normalization.traktTotalWatchersMax),
      0,
      1,
    );

    const avgRating = this.calculateAvgRating(
      input.imdbRating,
      input.traktRating,
      input.metacriticRating,
      input.rottenTomatoesRating,
    );
    const avgRatingNorm = this.clamp(avgRating / RATING_SCALE_MAX, 0, 1);

    const totalVotes = (input.imdbVotes || 0) + (input.traktVotes || 0);
    const voteConfidenceNorm = this.calculateVoteConfidence(input.imdbVotes, input.traktVotes);

    const effectiveDate = input.lastAirDate ?? input.releaseDate;
    const freshnessNorm = this.calculateFreshness(
      effectiveDate,
      normalization.freshnessDecayDays,
      normalization.freshnessMinFloor,
    );

    // === CALCULATE COMPONENT SCORES ===

    const popularityScore =
      tmdbPopularityNorm * weights.tmdbPopularity +
      traktTotalWatchersNorm * weights.traktTotalWatchers;

    const qualityScore =
      avgRatingNorm * weights.avgRating + voteConfidenceNorm * weights.voteConfidence;

    const freshnessScore = freshnessNorm * weights.freshness;

    // === CALCULATE FINAL RATINGO SCORE ===

    let ratingoScore = popularityScore + qualityScore + freshnessScore;

    // Optional: Add small bonus for live watchers (max ~3 points)
    // This rewards currently trending content without making it a requirement
    if (input.traktLiveWatchers && input.traktLiveWatchers > 0) {
      const liveWatchersNorm = this.clamp(
        Math.log1p(input.traktLiveWatchers) / Math.log1p(liveWatchersBonus.cap),
        0,
        1,
      );
      ratingoScore += liveWatchersNorm * liveWatchersBonus.maxBonus;
    }

    // Apply gradual penalty for low vote count ("new junk" protection)
    // Linear gradient from minMultiplier at minVotes to 1.0 at maxVotes
    const voteMultiplier = this.calculateVoteMultiplier(
      totalVotes,
      votePenalty.minVotes,
      votePenalty.maxVotes,
      votePenalty.minMultiplier,
    );
    ratingoScore *= voteMultiplier;

    // Return scores normalized to 0-100 range
    const popularityWeightSum = weights.tmdbPopularity + weights.traktTotalWatchers;
    return {
      ratingoScore: this.clamp(ratingoScore * PERCENT_SCALE, 0, PERCENT_SCALE),
      qualityScore: this.clamp(
        (qualityScore / (weights.avgRating + weights.voteConfidence)) * PERCENT_SCALE,
        0,
        PERCENT_SCALE,
      ),
      popularityScore: this.clamp(
        (popularityScore / popularityWeightSum) * PERCENT_SCALE,
        0,
        PERCENT_SCALE,
      ),
      freshnessScore: this.clamp(freshnessNorm * PERCENT_SCALE, 0, PERCENT_SCALE),
      avgRating: this.clamp(avgRating, 0, RATING_SCALE_MAX), // Pure rating without confidence
      totalVotes,
    };
  }

  /**
   * Calculates weighted average rating from multiple sources.
   * Dynamically normalizes weights based on available ratings.
   */
  private calculateAvgRating(
    imdbRating?: number | null,
    traktRating?: number | null,
    mcRating?: number | null,
    rtRating?: number | null,
  ): number {
    const { ratingWeights } = this.config;

    const sources: RatingSource[] = [
      { value: imdbRating, weight: ratingWeights.imdb },
      { value: traktRating, weight: ratingWeights.trakt },
      {
        value: mcRating == null ? null : mcRating / RATING_SCALE_MAX,
        weight: ratingWeights.metacritic,
      },
      {
        value: rtRating == null ? null : rtRating / RATING_SCALE_MAX,
        weight: ratingWeights.rottenTomatoes,
      },
    ];

    // Filter out null, undefined, and 0 (0 means "no rating" in TMDB/Trakt)
    const active = sources.filter((s) => typeof s.value === 'number' && s.value !== null);

    if (active.length === 0) {
      return NEUTRAL_RATING_DEFAULT; // Neutral default
    }

    const totalWeight = active.reduce((sum, s) => sum + s.weight, 0);
    return active.reduce((sum, s) => sum + s.value! * s.weight, 0) / totalWeight;
  }

  /**
   * Calculates freshness score with exponential decay and minimum floor.
   * Ensures classics don't fall to zero.
   */
  private calculateFreshness(
    releaseDate?: Date | string | null,
    decayDays = 180,
    minFloor = 0.2,
  ): number {
    if (!releaseDate) {
      return minFloor; // Unknown release date = treat as old
    }

    // Ensure releaseDate is a Date object
    const date = releaseDate instanceof Date ? releaseDate : new Date(releaseDate);
    if (isNaN(date.getTime())) {
      return minFloor; // Invalid date = treat as old
    }

    const now = new Date();
    const daysSinceRelease = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY));

    const expDecay = Math.exp(-daysSinceRelease / decayDays);
    return this.clamp(Math.max(expDecay, minFloor), 0, 1);
  }

  /**
   * Calculates vote confidence based on available sources only.
   * Missing source ≠ negative signal — we only measure what we have.
   */
  private calculateVoteConfidence(imdbVotes?: number | null, traktVotes?: number | null): number {
    const sources: Array<{ votes: number; k: number }> = [];

    if (imdbVotes && imdbVotes > 0) {
      sources.push({ votes: imdbVotes, k: IMDB_CONFIDENCE_K });
    }
    if (traktVotes && traktVotes > 0) {
      sources.push({ votes: traktVotes, k: TRAKT_CONFIDENCE_K });
    }

    // No vote data = neutral confidence (not penalized)
    if (sources.length === 0) {
      return NEUTRAL_CONFIDENCE_DEFAULT;
    }

    // Average confidence across available sources
    const confidences = sources.map((s) => 1 - Math.exp(-s.votes / s.k));
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    return this.clamp(avgConfidence, 0, 1);
  }

  /**
   * Calculates vote-based multiplier using linear interpolation.
   * Provides gradual penalty instead of cliff at threshold.
   *
   * @param votes - Total vote count
   * @param minVotes - Below this: full penalty (minMultiplier)
   * @param maxVotes - Above this: no penalty (1.0)
   * @param minMultiplier - Multiplier at or below minVotes
   * @returns Multiplier between minMultiplier and 1.0
   */
  private calculateVoteMultiplier(
    votes: number,
    minVotes: number,
    maxVotes: number,
    minMultiplier: number,
  ): number {
    if (votes <= minVotes) return minMultiplier;
    if (votes >= maxVotes) return 1.0;

    // Linear interpolation: t goes from 0 to 1 as votes go from minVotes to maxVotes
    const t = (votes - minVotes) / (maxVotes - minVotes);
    return minMultiplier + t * (1.0 - minMultiplier);
  }

  /**
   * Clamps a value between min and max.
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
