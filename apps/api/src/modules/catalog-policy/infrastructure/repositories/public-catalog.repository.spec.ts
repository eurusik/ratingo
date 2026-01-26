/**
 * Public Catalog Repository Tests
 *
 * Unit tests for public media item queries:
 * - findTrending
 * - search
 * - findForHomepage
 * - findById
 * - findBySlug
 * - countEligible
 */

import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';

import { PublicCatalogRepository } from './public-catalog.repository';

describe('PublicCatalogRepository', () => {
  let repository: PublicCatalogRepository;
  let mockDb: any;

  const mockRawRow = {
    id: 'item-123',
    type: 'movie',
    tmdb_id: 12345,
    imdb_id: 'tt1234567',
    title: 'Test Movie',
    original_title: 'Original Title',
    slug: 'test-movie',
    overview: 'A test movie overview',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    videos: [],
    credits: null,
    watch_providers_raw: null,
    trending_score: 85,
    trending_rank: 10,
    popularity: 100,
    rating: 7.5,
    vote_count: 1000,
    rating_imdb: 7.2,
    rating_metacritic: 75,
    rating_rotten_tomatoes: 80,
    rating_trakt: 7.8,
    release_date: '2024-01-15',
    origin_countries: ['US'],
    original_language: 'en',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    ratingo_score: 75,
    quality_score: 80,
    popularity_score: 70,
    freshness_score: 85,
    watchers_count: 500,
    relevance_score: 80,
    eligibility_status: 'eligible',
  };

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicCatalogRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<PublicCatalogRepository>(PublicCatalogRepository);
  });

  describe('findTrending', () => {
    it('should return trending items ordered by composite score', async () => {
      mockDb.execute.mockResolvedValueOnce([mockRawRow]);

      const result = await repository.findTrending();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-123');
      expect(result[0].tmdbId).toBe(12345);
      expect(result[0].trendingScore).toBe(85);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should filter by type when specified', async () => {
      mockDb.execute.mockResolvedValueOnce([mockRawRow]);

      await repository.findTrending({ type: 'movie' });

      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should apply pagination options', async () => {
      mockDb.execute.mockResolvedValueOnce([]);

      await repository.findTrending({ limit: 10, offset: 20 });

      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should return empty array when no trending items', async () => {
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await repository.findTrending();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findTrending()).rejects.toThrow(DatabaseException);
    });
  });

  describe('search', () => {
    it('should return matching items ordered by rank', async () => {
      mockDb.execute.mockResolvedValueOnce([mockRawRow]);

      const result = await repository.search('Test Movie');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Movie');
    });

    it('should return empty array for empty query', async () => {
      const result = await repository.search('');

      expect(result).toEqual([]);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only query', async () => {
      const result = await repository.search('   ');

      expect(result).toEqual([]);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should filter by type when specified', async () => {
      mockDb.execute.mockResolvedValueOnce([]);

      await repository.search('action', { type: 'show' });

      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.search('test')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findForHomepage', () => {
    it('should return items with minimum relevance score', async () => {
      mockDb.execute.mockResolvedValueOnce([mockRawRow]);

      const result = await repository.findForHomepage({ minRelevanceScore: 70 });

      expect(result).toHaveLength(1);
      expect(result[0].relevanceScore).toBe(80);
    });

    it('should apply limit option', async () => {
      mockDb.execute.mockResolvedValueOnce([]);

      await repository.findForHomepage({ limit: 50 });

      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should return empty array when no items meet criteria', async () => {
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await repository.findForHomepage({ minRelevanceScore: 100 });

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findForHomepage()).rejects.toThrow(DatabaseException);
    });
  });

  describe('findById', () => {
    it('should return item when found', async () => {
      mockDb.execute.mockResolvedValueOnce([mockRawRow]);

      const result = await repository.findById('item-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('item-123');
      expect(result?.slug).toBe('test-movie');
    });

    it('should return null when not found', async () => {
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should map snake_case to camelCase correctly', async () => {
      mockDb.execute.mockResolvedValueOnce([mockRawRow]);

      const result = await repository.findById('item-123');

      expect(result?.tmdbId).toBe(12345);
      expect(result?.imdbId).toBe('tt1234567');
      expect(result?.posterPath).toBe('/poster.jpg');
      expect(result?.releaseDate).toEqual(new Date('2024-01-15'));
      expect(result?.ratingoScore).toBe(75);
      expect(result?.watchersCount).toBe(500);
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findById('item-123')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findBySlug', () => {
    it('should return item when found', async () => {
      mockDb.execute.mockResolvedValueOnce([mockRawRow]);

      const result = await repository.findBySlug('test-movie');

      expect(result).not.toBeNull();
      expect(result?.slug).toBe('test-movie');
    });

    it('should return null when not found', async () => {
      mockDb.execute.mockResolvedValueOnce([]);

      const result = await repository.findBySlug('non-existent-slug');

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findBySlug('test-movie')).rejects.toThrow(DatabaseException);
    });
  });

  describe('countEligible', () => {
    it('should return total count of eligible items', async () => {
      mockDb.execute.mockResolvedValueOnce([{ count: 1500 }]);

      const result = await repository.countEligible();

      expect(result).toBe(1500);
    });

    it('should filter by type when specified', async () => {
      mockDb.execute.mockResolvedValueOnce([{ count: 800 }]);

      const result = await repository.countEligible('movie');

      expect(result).toBe(800);
    });

    it('should return 0 when no eligible items', async () => {
      mockDb.execute.mockResolvedValueOnce([{ count: 0 }]);

      const result = await repository.countEligible();

      expect(result).toBe(0);
    });

    it('should return 0 when count is null/undefined', async () => {
      mockDb.execute.mockResolvedValueOnce([{}]);

      const result = await repository.countEligible();

      expect(result).toBe(0);
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.countEligible()).rejects.toThrow(DatabaseException);
    });
  });
});
