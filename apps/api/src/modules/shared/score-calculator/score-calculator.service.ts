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
  tmdbPopularity: number;
  traktWatchers: number;

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
    const { weights, normalization, penalties } = this.config;

    // === NORMALIZE ALL VALUES TO [0, 1] ===

    const tmdbPopularityNorm = this.clamp(
      input.tmdbPopularity / normalization.tmdbPopularityMax,
      0,
      1,
    );

    const traktWatchersNorm = this.clamp(
      Math.log1p(input.traktWatchers) / Math.log1p(normalization.traktWatchersMax),
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

    const freshnessNorm = this.calculateFreshness(
      input.releaseDate,
      normalization.freshnessDecayDays,
      normalization.freshnessMinFloor,
    );

    // === CALCULATE COMPONENT SCORES ===

    const popularityScore =
      tmdbPopularityNorm * weights.tmdbPopularity + traktWatchersNorm * weights.traktWatchers;

    const qualityScore =
      avgRatingNorm * weights.avgRating + voteConfidenceNorm * weights.voteConfidence;

    const freshnessScore = freshnessNorm * weights.freshness;

    // === CALCULATE FINAL RATINGO SCORE ===

    let ratingoScore = popularityScore + qualityScore + freshnessScore;

    // Apply penalty for low vote count ("new junk" protection)
    if (totalVotes < penalties.lowVoteThreshold) {
      ratingoScore *= penalties.lowVotePenalty;
    }

    // Return scores normalized to 0-100 range
    return {
      ratingoScore: this.clamp(ratingoScore * PERCENT_SCALE, 0, PERCENT_SCALE),
      qualityScore: this.clamp(
        (qualityScore / (weights.avgRating + weights.voteConfidence)) * PERCENT_SCALE,
        0,
        PERCENT_SCALE,
      ),
      popularityScore: this.clamp(
        (popularityScore / (weights.tmdbPopularity + weights.traktWatchers)) * PERCENT_SCALE,
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
      { value: mcRating ? mcRating / RATING_SCALE_MAX : null, weight: ratingWeights.metacritic },
      {
        value: rtRating ? rtRating / RATING_SCALE_MAX : null,
        weight: ratingWeights.rottenTomatoes,
      },
    ];

    // Filter out null, undefined, and 0 (0 means "no rating" in TMDB/Trakt)
    const active = sources.filter(
      (s) => typeof s.value === 'number' && s.value !== null && s.value > 0,
    );

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
   * Clamps a value between min and max.
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
