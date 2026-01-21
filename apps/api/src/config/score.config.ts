import { registerAs } from '@nestjs/config';

/**
 * Configuration for Ratingo Score calculation.
 * All weights should sum to 1.0.
 */
export default registerAs('score', () => ({
  // Normalization constants (using log1p normalization)
  normalization: {
    tmdbPopularityMax: 500, // TMDB popularity cap (p95=120, max=490)
    traktTotalWatchersMax: 500_000, // All-time watchers cap (p95=206k, max=454k)
    traktLiveWatchersMax: 5000, // Live watchers cap (for optional bonus)
    freshnessDecayDays: 180, // Half-life for freshness decay
    freshnessMinFloor: 0.2, // Minimum freshness for classics
  },

  // Score weights (must sum to 1.0)
  // Popularity = 40% (TMDB 24% + Trakt total 16%), Quality = 40%, Freshness = 20%
  weights: {
    tmdbPopularity: 0.24, // TMDB popularity (more stable, higher weight)
    traktTotalWatchers: 0.16, // Trakt all-time watchers (stable signal)
    avgRating: 0.25, // Quality/rating component
    voteConfidence: 0.15, // Vote count confidence
    freshness: 0.2, // Freshness/recency bonus
  },

  // Optional live watchers bonus (max ~3 points on 100 scale)
  liveWatchersBonus: {
    maxBonus: 0.03, // Maximum bonus as fraction of total score
    cap: 5000, // Cap for log normalization
  },

  // Rating source weights for avgRating calculation
  ratingWeights: {
    imdb: 0.35,
    trakt: 0.35,
    metacritic: 0.15,
    rottenTomatoes: 0.15,
  },

  // Vote confidence penalty (gradual, not cliff)
  votePenalty: {
    minVotes: 10, // Below this: full penalty
    maxVotes: 50, // Above this: no penalty
    minMultiplier: 0.85, // Penalty at minVotes (linear gradient to 1.0 at maxVotes)
  },
}));
