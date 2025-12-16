import { ScoreCalculatorService, ScoreInput } from './score-calculator.service';

describe('ScoreCalculatorService', () => {
  let service: ScoreCalculatorService;

  // Default config matching score.config.ts
  const mockConfig = {
    weights: {
      tmdbPopularity: 0.2,
      traktWatchers: 0.2,
      avgRating: 0.25,
      voteConfidence: 0.15,
      freshness: 0.2,
    },
    ratingWeights: {
      imdb: 0.4,
      trakt: 0.25,
      metacritic: 0.2,
      rottenTomatoes: 0.15,
    },
    normalization: {
      tmdbPopularityMax: 500,
      traktWatchersMax: 10000,
      voteConfidenceK: 5000,
      freshnessDecayDays: 180,
      freshnessMinFloor: 0.2,
    },
    penalties: {
      lowVoteThreshold: 100,
      lowVotePenalty: 0.7,
    },
  };

  beforeEach(() => {
    service = new ScoreCalculatorService(mockConfig as any);
  });

  describe('calculate', () => {
    it('should return scores between 0 and 1', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 1000,
        imdbRating: 7.5,
        traktRating: 7.0,
        metacriticRating: 70,
        rottenTomatoesRating: 75,
        imdbVotes: 10000,
        traktVotes: 5000,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.ratingoScore).toBeGreaterThanOrEqual(0);
      expect(result.ratingoScore).toBeLessThanOrEqual(100);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      expect(result.popularityScore).toBeGreaterThanOrEqual(0);
      expect(result.popularityScore).toBeLessThanOrEqual(100);
      expect(result.freshnessScore).toBeGreaterThanOrEqual(0);
      expect(result.freshnessScore).toBeLessThanOrEqual(100);
    });

    it('should give higher score to popular content with good ratings', () => {
      const popular: ScoreInput = {
        tmdbPopularity: 400,
        traktWatchers: 8000,
        imdbRating: 8.5,
        traktRating: 8.0,
        imdbVotes: 50000,
        traktVotes: 20000,
        releaseDate: new Date(),
      };

      const unpopular: ScoreInput = {
        tmdbPopularity: 10,
        traktWatchers: 100,
        imdbRating: 5.0,
        traktRating: 5.0,
        imdbVotes: 500,
        traktVotes: 200,
        releaseDate: new Date(),
      };

      const popularScore = service.calculate(popular);
      const unpopularScore = service.calculate(unpopular);

      expect(popularScore.ratingoScore).toBeGreaterThan(unpopularScore.ratingoScore);
    });

    it('should apply low vote penalty for content with few votes', () => {
      const fewVotes: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 9.0,
        traktRating: 9.0,
        imdbVotes: 50, // Below threshold
        traktVotes: 30,
        releaseDate: new Date(),
      };

      const manyVotes: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 9.0,
        traktRating: 9.0,
        imdbVotes: 5000,
        traktVotes: 3000,
        releaseDate: new Date(),
      };

      const fewVotesScore = service.calculate(fewVotes);
      const manyVotesScore = service.calculate(manyVotes);

      // Few votes should be penalized
      expect(fewVotesScore.ratingoScore).toBeLessThan(manyVotesScore.ratingoScore);
    });

    it('should handle missing ratings gracefully', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        // No ratings provided
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.ratingoScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('should give higher freshness score to recent releases', () => {
      const recent: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 7.0,
        releaseDate: new Date(), // Today
      };

      const old: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 7.0,
        releaseDate: new Date('2020-01-01'), // Old
      };

      const recentScore = service.calculate(recent);
      const oldScore = service.calculate(old);

      expect(recentScore.freshnessScore).toBeGreaterThan(oldScore.freshnessScore);
    });

    it('should not let freshness drop below minimum floor', () => {
      const veryOld: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 7.0,
        releaseDate: new Date('1990-01-01'), // Very old
      };

      const result = service.calculate(veryOld);

      // Should be at or above the floor (0.2)
      expect(result.freshnessScore).toBeGreaterThanOrEqual(
        mockConfig.normalization.freshnessMinFloor,
      );
    });

    it('should handle null release date', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 7.0,
        releaseDate: null,
      };

      const result = service.calculate(input);

      // Should use minimum floor for unknown release date
      expect(result.freshnessScore).toBe(mockConfig.normalization.freshnessMinFloor * 100);
    });

    it('should normalize ratings from different scales', () => {
      // MC and RT are 0-100, IMDb and Trakt are 0-10
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 8.0, // 0-10 scale
        traktRating: 7.5, // 0-10 scale
        metacriticRating: 80, // 0-100 scale
        rottenTomatoesRating: 85, // 0-100 scale
        imdbVotes: 10000,
        traktVotes: 5000,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      // Quality score should be reasonable (not inflated by 0-100 scales)
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      expect(result.qualityScore).toBeGreaterThan(50); // Good ratings
    });
  });

  describe('avgRating and totalVotes', () => {
    it('should return avgRating as weighted average of available ratings', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 8.0,
        traktRating: 7.0,
        imdbVotes: 10000,
        traktVotes: 5000,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      // avgRating should be weighted average (imdb: 0.4, trakt: 0.25)
      // (8.0 * 0.4 + 7.0 * 0.25) / (0.4 + 0.25) = (3.2 + 1.75) / 0.65 = 7.615
      expect(result.avgRating).toBeCloseTo(7.615, 1);
    });

    it('should return totalVotes as sum of IMDb and Trakt votes', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 8.0,
        traktRating: 7.0,
        imdbVotes: 10000,
        traktVotes: 5000,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.totalVotes).toBe(15000);
    });

    it('should return avgRating of 5.0 when no ratings provided', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.avgRating).toBe(5.0); // Neutral default
    });

    it('should return totalVotes of 0 when no votes provided', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 8.0,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.totalVotes).toBe(0);
    });

    it('should clamp avgRating between 0 and 10', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktWatchers: 500,
        imdbRating: 10,
        traktRating: 10,
        metacriticRating: 100, // Converts to 10
        rottenTomatoesRating: 100, // Converts to 10
        imdbVotes: 10000,
        traktVotes: 5000,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.avgRating).toBeLessThanOrEqual(10);
      expect(result.avgRating).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero values', () => {
      const inputZero: ScoreInput = {
        tmdbPopularity: 0,
        traktWatchers: 0,
        imdbRating: 0,
        traktRating: 0,
        metacriticRating: 0,
        rottenTomatoesRating: 0,
        imdbVotes: 0,
        traktVotes: 0,
        releaseDate: null,
      };

      const result = service.calculate(inputZero);
      // Even with 0 inputs, freshness floor might add some score
      expect(result.ratingoScore).toBeGreaterThanOrEqual(0);
      expect(result.ratingoScore).toBeLessThanOrEqual(100);
    });

    it('should handle extremely high values', () => {
      const inputHigh: ScoreInput = {
        tmdbPopularity: 1000000,
        traktWatchers: 1000000,
        imdbRating: 10,
        traktRating: 10,
        metacriticRating: 100,
        rottenTomatoesRating: 100,
        imdbVotes: 10000000,
        traktVotes: 10000000,
        releaseDate: new Date(),
      };

      const result = service.calculate(inputHigh);
      expect(result.ratingoScore).toBeLessThanOrEqual(100);
    });
  });
});
