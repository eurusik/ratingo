import * as fc from 'fast-check';

import { ScoreCalculatorService, ScoreInput } from './score-calculator.service';

const config = {
  weights: {
    tmdbPopularity: 0.24,
    traktTotalWatchers: 0.16,
    avgRating: 0.25,
    voteConfidence: 0.15,
    freshness: 0.2,
  },
  ratingWeights: { imdb: 0.35, trakt: 0.35, metacritic: 0.15, rottenTomatoes: 0.15 },
  normalization: {
    tmdbPopularityMax: 500,
    traktTotalWatchersMax: 500_000,
    freshnessDecayDays: 180,
    freshnessMinFloor: 0.2,
  },
  liveWatchersBonus: { maxBonus: 0.03, cap: 5000 },
  votePenalty: { minVotes: 10, maxVotes: 50, minMultiplier: 0.85 },
};

const base: ScoreInput = { tmdbPopularity: 100, traktTotalWatchers: 1000 };

describe('ScoreCalculatorService (property-based)', () => {
  const service = new ScoreCalculatorService(config as never);
  const rating = fc.double({ min: 1, max: 10, noNaN: true });

  it('adding a 0-valued rating source never changes the average rating', () => {
    fc.assert(
      fc.property(rating, (imdb) => {
        const without = service.calculate({ ...base, imdbRating: imdb });
        const withZeroTrakt = service.calculate({ ...base, imdbRating: imdb, traktRating: 0 });
        const withZeroAll = service.calculate({
          ...base,
          imdbRating: imdb,
          traktRating: 0,
          metacriticRating: 0,
          rottenTomatoesRating: 0,
        });
        expect(withZeroTrakt.avgRating).toBeCloseTo(without.avgRating, 10);
        expect(withZeroAll.avgRating).toBeCloseTo(without.avgRating, 10);
      }),
    );
  });

  it('imdb=8, trakt=0 averages to 8 (regression)', () => {
    expect(service.calculate({ ...base, imdbRating: 8, traktRating: 0 }).avgRating).toBeCloseTo(8);
  });

  it('freshness of a future release is never higher than a release today', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3650 }), (daysAhead) => {
        const future = new Date(Date.now() + daysAhead * 86_400_000);
        const today = service.calculate({ ...base, releaseDate: new Date() });
        const unreleased = service.calculate({ ...base, releaseDate: future });
        expect(unreleased.freshnessScore).toBeLessThanOrEqual(today.freshnessScore);
      }),
    );
  });
});
