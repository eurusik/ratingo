import { calculatePureQuality, isHitQuality, ExternalRatings } from './quality.utils';

describe('quality.utils', () => {
  describe('calculatePureQuality', () => {
    it('calculates avgRating from all available sources', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 8.0, voteCount: 10000 },
        tmdb: { rating: 7.5, voteCount: 5000 },
        trakt: { rating: 7.0, voteCount: 2000 },
        metacritic: null,
        rottenTomatoes: null,
      };

      const result = calculatePureQuality(ratings);

      expect(result.avgRating).toBeCloseTo(7.5, 1); // (8 + 7.5 + 7) / 3
      expect(result.totalVotes).toBe(17000);
    });

    it('calculates avgRating from partial sources', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 8.0, voteCount: 10000 },
        tmdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      };

      const result = calculatePureQuality(ratings);

      expect(result.avgRating).toBe(8.0);
      expect(result.totalVotes).toBe(10000);
    });

    it('returns zeros when no ratings available', () => {
      const ratings: ExternalRatings = {
        imdb: null,
        tmdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      };

      const result = calculatePureQuality(ratings);

      expect(result.avgRating).toBe(0);
      expect(result.totalVotes).toBe(0);
    });

    it('handles missing voteCount gracefully', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 8.0 }, // No voteCount
        tmdb: { rating: 7.5, voteCount: null },
        trakt: { rating: 7.0, voteCount: 2000 },
        metacritic: null,
        rottenTomatoes: null,
      };

      const result = calculatePureQuality(ratings);

      expect(result.avgRating).toBeCloseTo(7.5, 1);
      expect(result.totalVotes).toBe(2000); // Only trakt has voteCount
    });

    it('ignores metacritic and rottenTomatoes (different scale)', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 8.0, voteCount: 10000 },
        tmdb: null,
        trakt: null,
        metacritic: { rating: 80, voteCount: 50 }, // 0-100 scale, should be ignored
        rottenTomatoes: { rating: 85, voteCount: 100 }, // 0-100 scale, should be ignored
      };

      const result = calculatePureQuality(ratings);

      expect(result.avgRating).toBe(8.0); // Only IMDb
      expect(result.totalVotes).toBe(10000);
    });
  });

  describe('isHitQuality', () => {
    it('returns true when avgRating >= 7.5 AND totalVotes >= 1000', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 8.5, voteCount: 50000 },
        tmdb: { rating: 8.0, voteCount: 20000 },
        trakt: { rating: 8.2, voteCount: 10000 },
        metacritic: null,
        rottenTomatoes: null,
      };

      expect(isHitQuality(ratings)).toBe(true);
    });

    it('returns false when avgRating < 7.5', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 7.0, voteCount: 50000 },
        tmdb: { rating: 6.5, voteCount: 20000 },
        trakt: { rating: 7.2, voteCount: 10000 },
        metacritic: null,
        rottenTomatoes: null,
      };

      expect(isHitQuality(ratings)).toBe(false);
    });

    it('returns false when totalVotes < 1000', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 9.0, voteCount: 500 },
        tmdb: { rating: 8.5, voteCount: 300 },
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      };

      expect(isHitQuality(ratings)).toBe(false);
    });

    it('returns false when no ratings available', () => {
      const ratings: ExternalRatings = {
        imdb: null,
        tmdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      };

      expect(isHitQuality(ratings)).toBe(false);
    });

    it('returns true at exact threshold (7.5 rating, 1000 votes)', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 7.5, voteCount: 1000 },
        tmdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      };

      expect(isHitQuality(ratings)).toBe(true);
    });

    it('returns false just below threshold', () => {
      const ratings: ExternalRatings = {
        imdb: { rating: 7.49, voteCount: 999 },
        tmdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      };

      expect(isHitQuality(ratings)).toBe(false);
    });
  });
});
