import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import scoreConfig from '@/config/score.config';

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
  metacriticRating?: number | null;    // 0-100
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
  ratingoScore: number;      // Main composite score (0-1)
  qualityScore: number;      // Rating-based component (0-1)
  popularityScore: number;   // Popularity-based component (0-1)
  freshnessScore: number;    // Time-based component (0-1)
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
      0, 1
    );

    const traktWatchersNorm = this.clamp(
      Math.log1p(input.traktWatchers) / Math.log1p(normalization.traktWatchersMax),
      0, 1
    );

    const avgRating = this.calculateAvgRating(
      input.imdbRating,
      input.traktRating,
      input.metacriticRating,
      input.rottenTomatoesRating
    );
    const avgRatingNorm = this.clamp(avgRating / 10, 0, 1);

    const totalVotes = (input.imdbVotes || 0) + (input.traktVotes || 0);
    const voteConfidenceNorm = this.clamp(
      1 - Math.exp(-totalVotes / normalization.voteConfidenceK),
      0, 1
    );

    const freshnessNorm = this.calculateFreshness(
      input.releaseDate,
      normalization.freshnessDecayDays,
      normalization.freshnessMinFloor
    );

    // === CALCULATE COMPONENT SCORES ===

    const popularityScore = 
      (tmdbPopularityNorm * weights.tmdbPopularity) +
      (traktWatchersNorm * weights.traktWatchers);

    const qualityScore = 
      (avgRatingNorm * weights.avgRating) +
      (voteConfidenceNorm * weights.voteConfidence);

    const freshnessScore = freshnessNorm * weights.freshness;

    // === CALCULATE FINAL RATINGO SCORE ===

    let ratingoScore = popularityScore + qualityScore + freshnessScore;

    // Apply penalty for low vote count ("new junk" protection)
    if (totalVotes < penalties.lowVoteThreshold) {
      ratingoScore *= penalties.lowVotePenalty;
    }

    return {
      ratingoScore: this.clamp(ratingoScore, 0, 1),
      qualityScore: this.clamp(qualityScore / (weights.avgRating + weights.voteConfidence), 0, 1),
      popularityScore: this.clamp(popularityScore / (weights.tmdbPopularity + weights.traktWatchers), 0, 1),
      freshnessScore: this.clamp(freshnessNorm, 0, 1),
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
    rtRating?: number | null
  ): number {
    const { ratingWeights } = this.config;

    const sources: RatingSource[] = [
      { value: imdbRating,                        weight: ratingWeights.imdb },
      { value: traktRating,                       weight: ratingWeights.trakt },
      { value: mcRating ? mcRating / 10 : null,   weight: ratingWeights.metacritic },
      { value: rtRating ? rtRating / 10 : null,   weight: ratingWeights.rottenTomatoes },
    ];

    const active = sources.filter(s => typeof s.value === 'number' && s.value !== null);

    if (active.length === 0) {
      return 5.0; // Neutral default
    }

    const totalWeight = active.reduce((sum, s) => sum + s.weight, 0);
    return active.reduce((sum, s) => sum + (s.value! * s.weight), 0) / totalWeight;
  }

  /**
   * Calculates freshness score with exponential decay and minimum floor.
   * Ensures classics don't fall to zero.
   */
  private calculateFreshness(
    releaseDate?: Date | null,
    decayDays = 180,
    minFloor = 0.2
  ): number {
    if (!releaseDate) {
      return minFloor; // Unknown release date = treat as old
    }

    const now = new Date();
    const daysSinceRelease = Math.max(0, 
      Math.floor((now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const expDecay = Math.exp(-daysSinceRelease / decayDays);
    return this.clamp(Math.max(expDecay, minFloor), 0, 1);
  }

  /**
   * Clamps a value between min and max.
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
