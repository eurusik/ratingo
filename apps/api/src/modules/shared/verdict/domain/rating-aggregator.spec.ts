import { aggregateRatings, formatRatingContext } from './rating-aggregator';
import { RATING_SOURCE } from './verdict.types';

describe('aggregateRatings', () => {
  describe('consensus rating (median)', () => {
    it('should return null for empty ratings', () => {
      const result = aggregateRatings(null);
      expect(result.consensusRating).toBeNull();
      expect(result.spread).toBe(0);
      expect(result.totalVotes).toBe(0);
    });

    it('should calculate median for odd number of ratings', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.0, voteCount: 1000 },
        trakt: { rating: 7.5, voteCount: 500 },
        tmdb: { rating: 7.0, voteCount: 200 },
      });

      // sorted: [7.0, 7.5, 8.0] -> median = 7.5
      expect(result.consensusRating).toBe(7.5);
    });

    it('should calculate median for even number of ratings', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.0, voteCount: 1000 },
        trakt: { rating: 7.0, voteCount: 500 },
        tmdb: null,
      });

      // sorted: [7.0, 8.0] -> median = (7.0 + 8.0) / 2 = 7.5
      expect(result.consensusRating).toBe(7.5);
    });

    it('should handle single rating source', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.5, voteCount: 1000 },
        trakt: null,
        tmdb: null,
      });

      expect(result.consensusRating).toBe(8.5);
      expect(result.ratingsCount).toBe(1);
    });
  });

  describe('spread calculation', () => {
    it('should calculate spread as max - min', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.0, voteCount: 1000 },
        trakt: { rating: 6.0, voteCount: 500 },
        tmdb: { rating: 7.0, voteCount: 200 },
      });

      // spread = 8.0 - 6.0 = 2.0
      expect(result.spread).toBe(2.0);
    });

    it('should return 0 spread for single rating', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.0, voteCount: 1000 },
        trakt: null,
        tmdb: null,
      });

      expect(result.spread).toBe(0);
    });

    it('should return 0 spread for identical ratings', () => {
      const result = aggregateRatings({
        imdb: { rating: 7.5, voteCount: 1000 },
        trakt: { rating: 7.5, voteCount: 500 },
        tmdb: { rating: 7.5, voteCount: 200 },
      });

      expect(result.spread).toBe(0);
    });
  });

  describe('total votes', () => {
    it('should sum votes from all sources', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.0, voteCount: 1000 },
        trakt: { rating: 7.0, voteCount: 500 },
        tmdb: { rating: 7.5, voteCount: 200 },
      });

      expect(result.totalVotes).toBe(1700);
    });

    it('should handle null vote counts', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.0, voteCount: null },
        trakt: { rating: 7.0, voteCount: 500 },
        tmdb: null,
      });

      expect(result.totalVotes).toBe(500);
    });
  });

  describe('primary source', () => {
    it('should select source with highest votes', () => {
      const result = aggregateRatings({
        imdb: { rating: 8.0, voteCount: 100 },
        trakt: { rating: 7.0, voteCount: 500 },
        tmdb: { rating: 7.5, voteCount: 200 },
      });

      expect(result.primarySource).toBe(RATING_SOURCE.TRAKT);
    });

    it('should default to IMDb when no ratings', () => {
      const result = aggregateRatings(null);
      expect(result.primarySource).toBe(RATING_SOURCE.IMDB);
    });
  });
});

describe('formatRatingContext', () => {
  it('should format rating with source', () => {
    expect(formatRatingContext(7.5, RATING_SOURCE.IMDB)).toBe('IMDb: 7.5');
    expect(formatRatingContext(8.0, RATING_SOURCE.TRAKT)).toBe('Trakt: 8.0');
  });

  it('should return null for null rating', () => {
    expect(formatRatingContext(null)).toBeNull();
    expect(formatRatingContext(undefined)).toBeNull();
  });

  it('should default to IMDb source', () => {
    expect(formatRatingContext(7.5)).toBe('IMDb: 7.5');
  });
});
