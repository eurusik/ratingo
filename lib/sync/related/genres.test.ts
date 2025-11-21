import { describe, it, expect, vi } from 'vitest';
import { getBaseGenres, hasBannedGenres, filterByGenres, filterShowsByGenres } from './genres';
import { tmdbClient } from '@/lib/api/tmdb';

// Mock the tmdbClient
vi.mock('@/lib/api/tmdb', () => ({
  tmdbClient: {
    getShowGenres: vi.fn(),
  },
}));

describe('related/genres', () => {
  describe('getBaseGenres', () => {
    it('should return an array of genre IDs on success', async () => {
      const mockGenres = [1, 2, 3];
      vi.mocked(tmdbClient.getShowGenres).mockResolvedValue(mockGenres);

      const genres = await getBaseGenres(123);

      expect(genres).toEqual(mockGenres);
      expect(tmdbClient.getShowGenres).toHaveBeenCalledWith(123);
    });

    it('should return an empty array if the API returns non-array data', async () => {
      vi.mocked(tmdbClient.getShowGenres).mockResolvedValue({} as any);

      const genres = await getBaseGenres(123);

      expect(genres).toEqual([]);
    });

    it('should return an empty array on API failure (handled by withRetry)', async () => {
      vi.mocked(tmdbClient.getShowGenres).mockRejectedValue(new Error('API Error'));

      // withRetry will throw after attempts, so we check for that
      await expect(getBaseGenres(123)).rejects.toThrow('API Error');
    });
  });

  describe('hasBannedGenres', () => {
    // BANNED_GENRES = [16, 99, 10764, 10767, 10763, 10766]
    it('should return true if any genre is banned', () => {
      expect(hasBannedGenres([1, 16, 3])).toBe(true);
      expect(hasBannedGenres([99])).toBe(true);
    });

    it('should return false if no genres are banned', () => {
      expect(hasBannedGenres([1, 2, 3])).toBe(false);
      expect(hasBannedGenres([])).toBe(false);
    });
  });

  describe('filterByGenres', () => {
    it('should return true if there is an intersection of genres', () => {
      expect(filterByGenres([1, 2, 3], [3, 4, 5])).toBe(true);
    });

    it('should return false if there is no intersection', () => {
      expect(filterByGenres([1, 2], [3, 4])).toBe(false);
    });

    it('should return true if baseGenres is empty', () => {
      expect(filterByGenres([1, 2, 3], [])).toBe(true);
    });

    it('should return false if itemGenres is empty and baseGenres is not', () => {
      expect(filterByGenres([], [1, 2])).toBe(false);
    });
  });

  describe('filterShowsByGenres', () => {
    const shows = [
      { id: 1, genres: [10, 20] }, // Keep
      { id: 2, genres: [16, 30] }, // Banned
      { id: 3, genres: [30, 40] }, // Filter out
      { id: 4, genres: [10, 50] }, // Keep
      { id: 5, genres: [] }, // Keep (matches any)
      { id: 6 }, // Keep (no genres)
    ];

    it('should filter shows based on base genres and banned genres', () => {
      const baseGenres = [10, 50];
      const result = filterShowsByGenres(shows, baseGenres);
      expect(result).toEqual([1, 4, 5, 6]);
    });

    it('should return all non-banned shows if baseGenres is empty', () => {
      const baseGenres: number[] = [];
      const result = filterShowsByGenres(shows, baseGenres);
      expect(result).toEqual([1, 3, 4, 5, 6]);
    });

    it('should return an empty array if all shows are filtered out or banned', () => {
      const baseGenres = [999];
      const showsToFilter = [
        { id: 1, genres: [16] }, // Banned
        { id: 2, genres: [100] }, // No match
      ];
      const result = filterShowsByGenres(showsToFilter, baseGenres);
      expect(result).toEqual([]);
    });
  });
});
