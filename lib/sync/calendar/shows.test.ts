import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrendingShows, getShowIdByTmdbId } from './shows';
import { db } from '@/db';
import { shows } from '@/db/schema';
import { and, isNotNull, eq } from 'drizzle-orm';

// Mocking the db and orm
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    and: vi.fn((...args) => `and(${args.join(', ')})`),
    isNotNull: vi.fn((field) => `isNotNull(${field.name})`),
    eq: vi.fn((field, value) => `eq(${field.name}, ${value})`),
  };
});

describe('calendar/shows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to their chainable behavior
    vi.mocked(db.select).mockReturnThis();
    vi.mocked(db.from).mockReturnThis();
    vi.mocked(db.where).mockReturnThis();
  });

  describe('getTrendingShows', () => {
    it('should return an array of trending show TMDB IDs', async () => {
      // Arrange
      const mockTrendingShows = [{ tmdbId: 101 }, { tmdbId: 102 }];
      vi.mocked(db.where).mockResolvedValue(mockTrendingShows);

      // Act
      const result = await getTrendingShows();

      // Assert
      expect(result).toEqual([101, 102]);
      expect(db.select).toHaveBeenCalledWith({ tmdbId: shows.tmdbId });
      expect(db.from).toHaveBeenCalledWith(shows);
      expect(db.where).toHaveBeenCalledWith(
        'and(isNotNull(trending_score), isNotNull(rating_trakt))'
      );
    });
  });

  describe('getShowIdByTmdbId', () => {
    it('should return the show ID for a given TMDB ID', async () => {
      // Arrange
      const mockShow = { id: 50 };
      vi.mocked(db.limit).mockResolvedValue([mockShow]);

      // Act
      const result = await getShowIdByTmdbId(12345);

      // Assert
      expect(result).toBe(50);
      expect(db.select).toHaveBeenCalledWith({ id: shows.id });
      expect(db.from).toHaveBeenCalledWith(shows);
      expect(db.where).toHaveBeenCalledWith('eq(tmdb_id, 12345)');
      expect(db.limit).toHaveBeenCalledWith(1);
    });

    it('should return null if no show is found', async () => {
      // Arrange
      vi.mocked(db.limit).mockResolvedValue([]);

      // Act
      const result = await getShowIdByTmdbId(999);

      // Assert
      expect(result).toBeNull();
    });
  });
});
