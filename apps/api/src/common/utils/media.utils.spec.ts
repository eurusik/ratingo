import { getBestRating, isNewRelease, hasRecentEpisode, RATING_SOURCE } from './media.utils';
import { NEW_RELEASE_WINDOW_DAYS } from '../constants';

describe('media.utils', () => {
  describe('getBestRating', () => {
    it('should return IMDb rating when available', () => {
      const ratings = {
        imdb: { rating: 8.5, voteCount: 1000 },
        trakt: { rating: 7.8, voteCount: 500 },
        tmdb: { rating: 7.2, voteCount: 200 },
      };

      const result = getBestRating(ratings);
      expect(result.rating).toEqual({ rating: 8.5, voteCount: 1000 });
      expect(result.source).toBe(RATING_SOURCE.IMDB);
    });

    it('should return Trakt rating when IMDb is not available', () => {
      const ratings = {
        imdb: null,
        trakt: { rating: 7.8, voteCount: 500 },
        tmdb: { rating: 7.2, voteCount: 200 },
      };

      const result = getBestRating(ratings);
      expect(result.rating).toEqual({ rating: 7.8, voteCount: 500 });
      expect(result.source).toBe(RATING_SOURCE.TRAKT);
    });

    it('should return TMDB rating when IMDb and Trakt are not available', () => {
      const ratings = {
        imdb: null,
        trakt: null,
        tmdb: { rating: 7.2, voteCount: 200 },
      };

      const result = getBestRating(ratings);
      expect(result.rating).toEqual({ rating: 7.2, voteCount: 200 });
      expect(result.source).toBe(RATING_SOURCE.TMDB);
    });

    it('should return null when no ratings are available', () => {
      const ratings = {
        imdb: null,
        trakt: null,
        tmdb: null,
      };

      const result = getBestRating(ratings);
      expect(result.rating).toBeNull();
      expect(result.source).toBeNull();
    });

    it('should return null when ratings object is null', () => {
      const result = getBestRating(null);
      expect(result.rating).toBeNull();
      expect(result.source).toBeNull();
    });

    it('should handle ratings without voteCount', () => {
      const ratings = {
        imdb: { rating: 8.5 },
        trakt: null,
        tmdb: null,
      };

      const result = getBestRating(ratings);
      expect(result.rating).toEqual({ rating: 8.5 });
      expect(result.source).toBe(RATING_SOURCE.IMDB);
    });
  });

  describe('isNewRelease', () => {
    const mockNow = new Date('2024-01-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(mockNow);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for release within default window (14 days)', () => {
      const releaseDate = new Date('2024-01-10T00:00:00Z'); // 5 days ago
      expect(isNewRelease(releaseDate)).toBe(true);
    });

    it('should return true for release on the same day', () => {
      const releaseDate = new Date('2024-01-15T00:00:00Z'); // today
      expect(isNewRelease(releaseDate)).toBe(true);
    });

    it('should return true for release exactly at window boundary', () => {
      const releaseDate = new Date('2024-01-01T12:00:00Z'); // exactly 14 days ago
      expect(isNewRelease(releaseDate)).toBe(true);
    });

    it('should return false for release outside default window', () => {
      const releaseDate = new Date('2023-12-31T00:00:00Z'); // 15 days ago
      expect(isNewRelease(releaseDate)).toBe(false);
    });

    it('should return false for future release dates', () => {
      const releaseDate = new Date('2024-01-20T00:00:00Z'); // 5 days in future
      expect(isNewRelease(releaseDate)).toBe(false);
    });

    it('should work with custom window days', () => {
      const releaseDate = new Date('2024-01-08T00:00:00Z'); // 7 days ago
      expect(isNewRelease(releaseDate, 10)).toBe(true); // within 10 days
      expect(isNewRelease(releaseDate, 5)).toBe(false); // outside 5 days
    });

    it('should work with string dates', () => {
      const releaseDate = '2024-01-10T00:00:00Z'; // 5 days ago
      expect(isNewRelease(releaseDate)).toBe(true);
    });

    it('should return false for null release date', () => {
      expect(isNewRelease(null)).toBe(false);
    });

    it('should return false for invalid date string', () => {
      expect(isNewRelease('invalid-date')).toBe(false);
    });

    it('should return false for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      expect(isNewRelease(invalidDate)).toBe(false);
    });

    it('should use NEW_RELEASE_WINDOW_DAYS constant as default', () => {
      const releaseDate = new Date('2024-01-01T12:00:00Z'); // exactly at boundary
      expect(isNewRelease(releaseDate)).toBe(isNewRelease(releaseDate, NEW_RELEASE_WINDOW_DAYS));
    });
  });

  describe('hasRecentEpisode', () => {
    const mockNow = new Date('2024-01-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(mockNow);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for episode aired within past week', () => {
      const airDate = new Date('2024-01-12T20:00:00Z'); // 3 days ago
      expect(hasRecentEpisode(airDate)).toBe(true);
    });

    it('should return true for episode aired today', () => {
      const airDate = new Date('2024-01-15T10:00:00Z'); // today, earlier
      expect(hasRecentEpisode(airDate)).toBe(true);
    });

    it('should return true for episode aired exactly 7 days ago', () => {
      const airDate = new Date('2024-01-08T12:00:00Z'); // exactly 7 days ago
      expect(hasRecentEpisode(airDate)).toBe(true);
    });

    it('should return false for episode aired more than 7 days ago', () => {
      const airDate = new Date('2024-01-07T00:00:00Z'); // 8+ days ago
      expect(hasRecentEpisode(airDate)).toBe(false);
    });

    it('should return false for future air dates', () => {
      const airDate = new Date('2024-01-20T20:00:00Z'); // 5 days in future
      expect(hasRecentEpisode(airDate)).toBe(false);
    });

    it('should work with string dates', () => {
      const airDate = '2024-01-12T20:00:00Z'; // 3 days ago
      expect(hasRecentEpisode(airDate)).toBe(true);
    });

    it('should return false for null air date', () => {
      expect(hasRecentEpisode(null)).toBe(false);
    });

    it('should return false for invalid date string', () => {
      expect(hasRecentEpisode('invalid-date')).toBe(false);
    });

    it('should return false for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      expect(hasRecentEpisode(invalidDate)).toBe(false);
    });
  });
});
