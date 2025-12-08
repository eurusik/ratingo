import { registerAs } from '@nestjs/config';

/**
 * Configuration for Ratingo Score calculation.
 * All weights should sum to 1.0.
 */
export default registerAs('score', () => ({
  // Normalization constants
  normalization: {
    tmdbPopularityMax: 1000,      // TMDB popularity usually 0-3000+
    traktWatchersMax: 5000,       // Top shows in prime time
    voteConfidenceK: 1000,        // Votes threshold for full confidence
    freshnessDecayDays: 180,      // Half-life for freshness decay
    freshnessMinFloor: 0.2,       // Minimum freshness for classics
  },

  // Score weights (must sum to 1.0)
  weights: {
    tmdbPopularity: 0.15,         // TMDB popularity component
    traktWatchers: 0.25,          // Trakt watchers component
    avgRating: 0.25,              // Quality/rating component
    voteConfidence: 0.15,         // Vote count confidence
    freshness: 0.20,              // Freshness/recency bonus
  },

  // Rating source weights for avgRating calculation
  ratingWeights: {
    imdb: 0.35,
    trakt: 0.35,
    metacritic: 0.15,
    rottenTomatoes: 0.15,
  },

  // Penalties
  penalties: {
    lowVoteThreshold: 30,         // Votes below this get penalized
    lowVotePenalty: 0.7,          // Multiply score by this if low votes
  },
}));
