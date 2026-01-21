import { ScoreCalculatorService, ScoreInput } from './score-calculator.service';

describe('ScoreCalculatorService', () => {
  let service: ScoreCalculatorService;

  // Default config matching score.config.ts
  const mockConfig = {
    weights: {
      tmdbPopularity: 0.24,
      traktTotalWatchers: 0.16,
      avgRating: 0.25,
      voteConfidence: 0.15,
      freshness: 0.2,
    },
    ratingWeights: {
      imdb: 0.35,
      trakt: 0.35,
      metacritic: 0.15,
      rottenTomatoes: 0.15,
    },
    normalization: {
      tmdbPopularityMax: 500,
      traktTotalWatchersMax: 500_000,
      freshnessDecayDays: 180,
      freshnessMinFloor: 0.2,
    },
    liveWatchersBonus: {
      maxBonus: 0.03,
      cap: 5000,
    },
    votePenalty: {
      minVotes: 10,
      maxVotes: 50,
      minMultiplier: 0.85,
    },
  };

  beforeEach(() => {
    service = new ScoreCalculatorService(mockConfig as any);
  });

  describe('calculate', () => {
    it('should return scores between 0 and 1', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 1000,
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
        traktTotalWatchers: 8000,
        imdbRating: 8.5,
        traktRating: 8.0,
        imdbVotes: 50000,
        traktVotes: 20000,
        releaseDate: new Date(),
      };

      const unpopular: ScoreInput = {
        tmdbPopularity: 10,
        traktTotalWatchers: 100,
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

    it('should apply gradual penalty for content with few votes', () => {
      const veryFewVotes: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
        imdbRating: 9.0,
        traktRating: 9.0,
        imdbVotes: 5, // Below minVotes (10) - full penalty
        traktVotes: 3,
        releaseDate: new Date(),
      };

      const someVotes: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
        imdbRating: 9.0,
        traktRating: 9.0,
        imdbVotes: 20, // Between minVotes (10) and maxVotes (50) - partial penalty
        traktVotes: 10,
        releaseDate: new Date(),
      };

      const manyVotes: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
        imdbRating: 9.0,
        traktRating: 9.0,
        imdbVotes: 5000, // Above maxVotes (50) - no penalty
        traktVotes: 3000,
        releaseDate: new Date(),
      };

      const veryFewVotesScore = service.calculate(veryFewVotes);
      const someVotesScore = service.calculate(someVotes);
      const manyVotesScore = service.calculate(manyVotes);

      // Gradual penalty: veryFew < some < many
      expect(veryFewVotesScore.ratingoScore).toBeLessThan(someVotesScore.ratingoScore);
      expect(someVotesScore.ratingoScore).toBeLessThan(manyVotesScore.ratingoScore);
    });

    it('should have monotonically increasing score within penalty gradient range', () => {
      const baseInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
        imdbRating: 8.0,
        traktRating: 8.0,
        releaseDate: new Date(),
      };

      // Test within gradient range (10-50 votes) where penalty eases off
      // Note: 0 votes uses neutral confidence (0.5), so excluding from monotonicity test
      const votePoints = [10, 20, 30, 40, 50];
      const scores = votePoints.map(
        (votes) =>
          service.calculate({
            ...baseInput,
            imdbVotes: votes,
            traktVotes: 0,
          }).ratingoScore,
      );

      // Each score should be >= previous within gradient range
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    it('should handle missing ratings gracefully', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
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
        traktTotalWatchers: 500,
        imdbRating: 7.0,
        releaseDate: new Date(), // Today
      };

      const old: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
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
        traktTotalWatchers: 500,
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
        traktTotalWatchers: 500,
        imdbRating: 7.0,
        releaseDate: null,
      };

      const result = service.calculate(input);

      // Should use minimum floor for unknown release date
      expect(result.freshnessScore).toBe(mockConfig.normalization.freshnessMinFloor * 100);
    });

    it('should handle releaseDate as string (ISO format)', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
        imdbRating: 7.0,
        releaseDate: '2024-01-15' as any, // String instead of Date
      };

      const result = service.calculate(input);

      expect(result.freshnessScore).toBeGreaterThanOrEqual(0);
      expect(result.freshnessScore).toBeLessThanOrEqual(100);
    });

    it('should handle invalid releaseDate string gracefully', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
        imdbRating: 7.0,
        releaseDate: 'invalid-date' as any, // Invalid string
      };

      const result = service.calculate(input);

      // Should use minimum floor for invalid date
      expect(result.freshnessScore).toBe(mockConfig.normalization.freshnessMinFloor * 100);
    });

    it('should normalize ratings from different scales', () => {
      // MC and RT are 0-100, IMDb and Trakt are 0-10
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
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
        traktTotalWatchers: 500,
        imdbRating: 8.0,
        traktRating: 7.0,
        imdbVotes: 10000,
        traktVotes: 5000,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      // avgRating should be weighted average (imdb: 0.35, trakt: 0.35)
      // (8.0 * 0.35 + 7.0 * 0.35) / (0.35 + 0.35) = (2.8 + 2.45) / 0.7 = 7.5
      expect(result.avgRating).toBeCloseTo(7.5, 1);
    });

    it('should return totalVotes as sum of IMDb and Trakt votes', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
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
        traktTotalWatchers: 500,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.avgRating).toBe(5.0); // Neutral default
    });

    it('should return totalVotes of 0 when no votes provided', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
        imdbRating: 8.0,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      expect(result.totalVotes).toBe(0);
    });

    it('should clamp avgRating between 0 and 10', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 500,
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
        traktTotalWatchers: 0,
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
        traktTotalWatchers: 1000000,
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

  describe('popularity calculation with totalWatchers', () => {
    it('should use totalWatchers as primary popularity signal', () => {
      const withHighWatchers: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 200000, // High total watchers
        imdbRating: 7.0,
        imdbVotes: 1000,
        releaseDate: new Date(),
      };

      const withLowWatchers: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 1000, // Low total watchers
        imdbRating: 7.0,
        imdbVotes: 1000,
        releaseDate: new Date(),
      };

      const highResult = service.calculate(withHighWatchers);
      const lowResult = service.calculate(withLowWatchers);

      // Higher total watchers should give higher popularity score
      expect(highResult.popularityScore).toBeGreaterThan(lowResult.popularityScore);
    });

    it('should give reasonable popularity score even without totalWatchers', () => {
      const noWatchers: ScoreInput = {
        tmdbPopularity: 200, // Good TMDB popularity
        traktTotalWatchers: 0, // No watchers data
        imdbRating: 7.0,
        imdbVotes: 1000,
        releaseDate: new Date(),
      };

      const result = service.calculate(noWatchers);

      // Should still have decent popularity from TMDB alone
      expect(result.popularityScore).toBeGreaterThan(30);
    });

    it('should add small bonus for live watchers (max ~3 points)', () => {
      const noLiveWatchers: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 50000,
        traktLiveWatchers: 0,
        imdbRating: 7.0,
        imdbVotes: 1000,
        releaseDate: new Date(),
      };

      const withLiveWatchers: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 50000,
        traktLiveWatchers: 5000, // Max live watchers cap
        imdbRating: 7.0,
        imdbVotes: 1000,
        releaseDate: new Date(),
      };

      const noLiveResult = service.calculate(noLiveWatchers);
      const withLiveResult = service.calculate(withLiveWatchers);

      // Live watchers bonus should be small (max ~3 points on 100 scale)
      const bonus = withLiveResult.ratingoScore - noLiveResult.ratingoScore;
      expect(bonus).toBeGreaterThan(0);
      expect(bonus).toBeLessThanOrEqual(4); // Allow small margin
    });

    it('should handle null traktLiveWatchers gracefully', () => {
      const input: ScoreInput = {
        tmdbPopularity: 100,
        traktTotalWatchers: 50000,
        traktLiveWatchers: null,
        imdbRating: 7.0,
        releaseDate: new Date(),
      };

      const result = service.calculate(input);

      // Should not throw and should return valid scores
      expect(result.ratingoScore).toBeGreaterThanOrEqual(0);
      expect(result.popularityScore).toBeGreaterThanOrEqual(0);
    });
  });
});
