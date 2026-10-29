/**
 * Dry-Run Repository Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DryRunRepository } from './dry-run.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions';

describe('DryRunRepository', () => {
  let repository: DryRunRepository;
  let mockDb: any;

  beforeEach(async () => {
    // Create a deeply chainable mock for Drizzle ORM
    mockDb = {
      select: jest.fn(),
      from: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      execute: jest.fn().mockResolvedValue([]),
    };

    // Make all methods return the mock (chainable) except limit which resolves
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.leftJoin.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [DryRunRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<DryRunRepository>(DryRunRepository);
  });

  describe('fetchSampleItems', () => {
    it('should execute raw SQL with TABLESAMPLE', async () => {
      const items = [{ id: '1', title: 'Test Movie' }];
      mockDb.execute.mockResolvedValue(items);

      const result = await repository.fetchSampleItems(100, 10);

      expect(mockDb.execute).toHaveBeenCalled();
      expect(result).toEqual(items);
    });
  });

  describe('fetchTopItems', () => {
    it('should query with popularity order and limit', async () => {
      const items = [{ id: '1', title: 'Popular Movie' }];
      mockDb.limit.mockResolvedValue(items);

      const result = await repository.fetchTopItems(50);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.leftJoin).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(items);
    });
  });

  describe('fetchByTypeItems', () => {
    it('should filter by media type', async () => {
      const items = [{ id: '1', title: 'Movie', type: MediaType.MOVIE }];
      mockDb.limit.mockResolvedValue(items);

      const result = await repository.fetchByTypeItems(MediaType.MOVIE, 100);

      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(items);
    });
  });

  describe('fetchByCountryItems', () => {
    it('should filter by country and uppercase it', async () => {
      const items = [{ id: '1', title: 'UA Movie', originCountries: ['UA'] }];
      mockDb.limit.mockResolvedValue(items);

      const result = await repository.fetchByCountryItems('ua', 100);

      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(items);
    });
  });

  describe('getCurrentEvaluations', () => {
    it('should return empty map for empty input', async () => {
      const result = await repository.getCurrentEvaluations([]);

      expect(result).toEqual(new Map());
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should return evaluations for small batch', async () => {
      const evaluations = [
        { mediaItemId: '1', status: 'ELIGIBLE' },
        { mediaItemId: '2', status: 'INELIGIBLE' },
      ];
      mockDb.where.mockResolvedValue(evaluations);

      const result = await repository.getCurrentEvaluations(['1', '2']);

      expect(result.size).toBe(2);
      expect(result.get('1')).toEqual({ mediaItemId: '1', status: 'ELIGIBLE' });
      expect(result.get('2')).toEqual({ mediaItemId: '2', status: 'INELIGIBLE' });
    });

    it('should batch large requests', async () => {
      // Create 2500 IDs (should result in 3 batches of 1000, 1000, 500)
      const ids = Array.from({ length: 2500 }, (_, i) => `id-${i}`);

      // Mock returns different results per batch
      let callCount = 0;
      mockDb.where.mockImplementation(() => {
        callCount++;
        return Promise.resolve([
          { mediaItemId: `id-${(callCount - 1) * 1000}`, status: 'ELIGIBLE' },
        ]);
      });

      const result = await repository.getCurrentEvaluations(ids);

      // Should have been called 3 times (batches of 1000, 1000, 500)
      expect(mockDb.where).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(3); // One result per batch in our mock
    });

    it('should handle exactly 1000 items in single batch', async () => {
      const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
      mockDb.where.mockResolvedValue([{ mediaItemId: 'id-0', status: 'ELIGIBLE' }]);

      await repository.getCurrentEvaluations(ids);

      expect(mockDb.where).toHaveBeenCalledTimes(1);
    });

    it('should handle 1001 items in two batches', async () => {
      const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
      mockDb.where.mockResolvedValue([]);

      await repository.getCurrentEvaluations(ids);

      expect(mockDb.where).toHaveBeenCalledTimes(2);
    });

    it('should filter by catalog context and the active policy version', async () => {
      mockDb.where.mockResolvedValue([{ mediaItemId: '1', status: 'eligible' }]);

      await repository.getCurrentEvaluations(['1']);

      const { sql: text, params } = new PgDialect().sqlToQuery(mockDb.where.mock.calls[0][0]);
      expect(text).toContain('"context" = $');
      expect(text).toContain('"policy_version" = (SELECT');
      expect(text).toContain('"is_active" = true');
      expect(params).toContain('catalog');
    });

    it('should wrap database failures in DatabaseException', async () => {
      mockDb.where.mockRejectedValue(new Error('DB down'));

      await expect(repository.getCurrentEvaluations(['1'])).rejects.toThrow(DatabaseException);
    });
  });

  describe('error wrapping', () => {
    it('should wrap fetchTopItems failures in DatabaseException', async () => {
      mockDb.limit.mockRejectedValue(new Error('DB down'));

      await expect(repository.fetchTopItems(10)).rejects.toThrow(DatabaseException);
    });

    it('should wrap fetchSampleItems failures in DatabaseException', async () => {
      mockDb.execute.mockRejectedValue(new Error('DB down'));

      await expect(repository.fetchSampleItems(10, 5)).rejects.toThrow(DatabaseException);
    });
  });
});
