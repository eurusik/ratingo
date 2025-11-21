import { describe, it, expect } from 'vitest';
import { processWatchedShows, processWatchedMovies } from './processors';

describe('monthly/processors', () => {
  describe('processWatchedShows', () => {
    it('should process valid show data into a watchers map', () => {
      const shows = [
        { watchers: 100, show: { ids: { tmdb: 1 } } },
        { watchers: 200, show: { ids: { tmdb: 2 } } },
      ];
      expect(processWatchedShows(shows)).toEqual({ 1: 100, 2: 200 });
    });

    it('should ignore shows with invalid data', () => {
      const shows = [
        { watchers: 100, show: { ids: { tmdb: 1 } } },
        { watchers: null, show: { ids: { tmdb: 2 } } }, // null watchers
        { watchers: 300, show: { ids: {} } }, // no tmdb id
        { show: { ids: { tmdb: 4 } } }, // no watchers
        null, // null item
      ];
      expect(processWatchedShows(shows)).toEqual({ 1: 100 });
    });

    it('should return an empty object for non-array input', () => {
      expect(processWatchedShows(null)).toEqual({});
      expect(processWatchedShows(undefined)).toEqual({});
      expect(processWatchedShows({} as any)).toEqual({});
    });

    it('should return an empty object for an empty array', () => {
      expect(processWatchedShows([])).toEqual({});
    });
  });

  describe('processWatchedMovies', () => {
    it('should process valid movie data into a watchers map', () => {
      const movies = [
        { watchers: 300, movie: { ids: { tmdb: 3 } } },
        { watchers: 400, movie: { ids: { tmdb: 4 } } },
      ];
      expect(processWatchedMovies(movies)).toEqual({ 3: 300, 4: 400 });
    });

    it('should ignore movies with invalid data', () => {
      const movies = [
        { watchers: 300, movie: { ids: { tmdb: 3 } } },
        { movie: { ids: { tmdb: 4 } } }, // no watchers
        { watchers: 500, movie: { ids: {} } }, // no tmdb id
        { watchers: null, movie: { ids: { tmdb: 5 } } }, // null watchers
        {}, // empty object
      ];
      expect(processWatchedMovies(movies)).toEqual({ 3: 300 });
    });

    it('should return an empty object for non-array input', () => {
      expect(processWatchedMovies(null)).toEqual({});
      expect(processWatchedMovies(undefined)).toEqual({});
      expect(processWatchedMovies('string' as any)).toEqual({});
    });

    it('should return an empty object for an empty array', () => {
      expect(processWatchedMovies([])).toEqual({});
    });
  });
});
