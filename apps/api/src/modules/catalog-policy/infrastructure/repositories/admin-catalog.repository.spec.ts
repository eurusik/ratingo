/**
 * Admin Catalog Repository Tests
 *
 * Unit tests for admin media item queries:
 * - findAll (with filtering, sorting, pagination)
 * - findById
 * - findByEligibilityStatus
 * - countByEligibilityStatus
 * - findByEvaluationReason
 */

import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { EligibilityStatus } from '../../domain/constants/evaluation.constants';

import { AdminCatalogRepository } from './admin-catalog.repository';

describe('AdminCatalogRepository', () => {
  let repository: AdminCatalogRepository;
  let mockDb: any;

  const mockMediaItemRow = {
    id: 'item-123',
    type: 'movie',
    tmdbId: 12345,
    imdbId: 'tt1234567',
    title: 'Test Movie',
    originalTitle: 'Original Title',
    slug: 'test-movie',
    overview: 'A test movie overview',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    trendingScore: 85,
    trendingRank: 10,
    popularity: 100,
    rating: 7.5,
    releaseDate: new Date('2024-01-15'),
    originCountries: ['US'],
    originalLanguage: 'en',
    ingestionStatus: 'ready',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-10'),
    deletedAt: null,
    eligibilityStatus: 'eligible',
    evaluationReasons: ['HAS_UA_PROVIDER'],
    relevanceScore: 80,
    policyVersion: 1,
    breakoutRuleId: null,
    evaluatedAt: new Date('2024-01-05'),
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminCatalogRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<AdminCatalogRepository>(AdminCatalogRepository);
  });

  describe('findAll', () => {
    it('should return all media items with evaluations', async () => {
      mockDb.offset.mockResolvedValueOnce([mockMediaItemRow]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-123');
      expect(result[0].title).toBe('Test Movie');
      expect(result[0].eligibilityStatus).toBe('eligible');
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.leftJoin).toHaveBeenCalled();
    });

    it('should apply pagination options', async () => {
      mockDb.offset.mockResolvedValueOnce([mockMediaItemRow]);

      await repository.findAll({ limit: 10, offset: 20 });

      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(20);
    });

    it('should filter by type', async () => {
      mockDb.offset.mockResolvedValueOnce([mockMediaItemRow]);

      await repository.findAll({ type: MediaType.MOVIE });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return empty array when no items found', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.offset.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findAll()).rejects.toThrow(DatabaseException);
    });
  });

  describe('findById', () => {
    it('should return media item when found', async () => {
      mockDb.limit.mockResolvedValueOnce([mockMediaItemRow]);

      const result = await repository.findById('item-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('item-123');
      expect(result?.evaluationReasons).toEqual(['HAS_UA_PROVIDER']);
    });

    it('should return null when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findById('item-123')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findByEligibilityStatus', () => {
    it('should delegate to findAll with status filter', async () => {
      mockDb.offset.mockResolvedValueOnce([mockMediaItemRow]);

      const result = await repository.findByEligibilityStatus(EligibilityStatus.ELIGIBLE);

      expect(result).toHaveLength(1);
      expect(result[0].eligibilityStatus).toBe('eligible');
    });

    it('should pass through additional options', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      await repository.findByEligibilityStatus(EligibilityStatus.INELIGIBLE, {
        limit: 5,
        type: MediaType.SHOW,
      });

      expect(mockDb.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('countByEligibilityStatus', () => {
    it('should return counts grouped by status', async () => {
      mockDb.groupBy.mockResolvedValueOnce([
        { status: 'eligible', count: 100 },
        { status: 'ineligible', count: 50 },
        { status: 'review', count: 10 },
      ]);

      const result = await repository.countByEligibilityStatus();

      expect(result).toEqual({
        eligible: 100,
        ineligible: 50,
        review: 10,
      });
    });

    it('should return zeros for missing statuses', async () => {
      mockDb.groupBy.mockResolvedValueOnce([{ status: 'eligible', count: 100 }]);

      const result = await repository.countByEligibilityStatus();

      expect(result).toEqual({
        eligible: 100,
        ineligible: 0,
        review: 0,
      });
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.groupBy.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.countByEligibilityStatus()).rejects.toThrow(DatabaseException);
    });
  });

  describe('findByEvaluationReason', () => {
    it('should return items with specific reason', async () => {
      mockDb.offset.mockResolvedValueOnce([mockMediaItemRow]);

      const result = await repository.findByEvaluationReason('HAS_UA_PROVIDER');

      expect(result).toHaveLength(1);
      expect(result[0].evaluationReasons).toContain('HAS_UA_PROVIDER');
    });

    it('should apply pagination options', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      await repository.findByEvaluationReason('MISSING_POSTER', { limit: 25, offset: 50 });

      expect(mockDb.limit).toHaveBeenCalledWith(25);
      expect(mockDb.offset).toHaveBeenCalledWith(50);
    });

    it('should filter by type', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      await repository.findByEvaluationReason('NO_UA_PROVIDER', { type: MediaType.MOVIE });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should throw DatabaseException on query failure', async () => {
      mockDb.offset.mockRejectedValueOnce(new Error('DB error'));

      await expect(repository.findByEvaluationReason('MISSING_OVERVIEW')).rejects.toThrow(
        DatabaseException,
      );
    });
  });
});
