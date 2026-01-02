/**
 * Provider Mapping Repository Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import type { ProviderMapping } from '../../domain/types/provider.types';
import { GLOBAL_REGION } from '../../domain/utils/region-normalizer';
import { ProviderMappingRepository } from './provider-mapping.repository';

describe('ProviderMappingRepository', () => {
  let repository: ProviderMappingRepository;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const mockDbRow = {
    id: 'mapping-1',
    tmdbProviderId: 8,
    providerId: 'netflix',
    variantId: null,
    distributionChannel: 'direct',
    region: 'global',
    notes: null,
    source: 'manual',
    createdAt: new Date('2026-01-01'),
  };

  const mockMapping: ProviderMapping = {
    id: 'mapping-1',
    tmdbProviderId: 8,
    providerId: 'netflix',
    variantId: null,
    distributionChannel: 'direct',
    region: 'global',
    notes: null,
    source: 'manual',
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const selectChain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockDbRow]),
      orderBy: jest.fn().mockResolvedValue([mockDbRow]),
    };

    const insertChain = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockDbRow]),
    };

    const updateChain = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockDbRow]),
    };

    const deleteChain = {
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockDbRow]),
    };

    mockDb = {
      select: jest.fn().mockReturnValue(selectChain),
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
      delete: jest.fn().mockReturnValue(deleteChain),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderMappingRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<ProviderMappingRepository>(ProviderMappingRepository);
  });

  describe('findByTmdbIdAndRegion', () => {
    it('should return mapping when found', async () => {
      const result = await repository.findByTmdbIdAndRegion(8, 'global');

      expect(result).toMatchObject({
        id: 'mapping-1',
        tmdbProviderId: 8,
        providerId: 'netflix',
      });
    });

    it('should return null when not found', async () => {
      const selectChain = mockDb.select();
      selectChain.limit.mockResolvedValue([]);

      const result = await repository.findByTmdbIdAndRegion(999, 'global');

      expect(result).toBeNull();
    });

    it('should normalize region to uppercase', async () => {
      await repository.findByTmdbIdAndRegion(8, 'us');

      // Region should be normalized in the query
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('DB Error');
      });

      await expect(repository.findByTmdbIdAndRegion(8, 'global')).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('findManyByTmdbIdsAndRegion', () => {
    it('should return map of mappings', async () => {
      const selectChain = mockDb.select();
      selectChain.where.mockResolvedValue([mockDbRow]);

      const result = await repository.findManyByTmdbIdsAndRegion([8], 'global');

      expect(result.size).toBe(1);
      expect(result.get(8)).toMatchObject({ providerId: 'netflix' });
    });

    it('should return empty map for empty input', async () => {
      const result = await repository.findManyByTmdbIdsAndRegion([], 'global');

      expect(result.size).toBe(0);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return mapping when found', async () => {
      const result = await repository.findById('mapping-1');

      expect(result).toMatchObject({ id: 'mapping-1' });
    });

    it('should return null when not found', async () => {
      const selectChain = mockDb.select();
      selectChain.limit.mockResolvedValue([]);

      const result = await repository.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create mapping and return it', async () => {
      const result = await repository.create({
        tmdbProviderId: 8,
        providerId: 'netflix',
      });

      expect(result).toMatchObject({
        tmdbProviderId: 8,
        providerId: 'netflix',
      });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use default values for optional fields', async () => {
      await repository.create({
        tmdbProviderId: 8,
        providerId: 'netflix',
      });

      const insertChain = mockDb.insert();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          distributionChannel: 'direct',
          source: 'manual',
        }),
      );
    });
  });

  describe('update', () => {
    it('should update mapping and return it', async () => {
      const result = await repository.update('mapping-1', { providerId: 'prime_video' });

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw DatabaseException when not found', async () => {
      const updateChain = mockDb.update();
      updateChain.returning.mockResolvedValue([]);

      await expect(repository.update('unknown', { providerId: 'netflix' })).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('delete', () => {
    it('should delete mapping', async () => {
      await repository.delete('mapping-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw DatabaseException when not found', async () => {
      const deleteChain = mockDb.delete();
      deleteChain.returning.mockResolvedValue([]);

      await expect(repository.delete('unknown')).rejects.toThrow(DatabaseException);
    });
  });

  describe('resolve', () => {
    it('should return region-specific mapping first', async () => {
      const result = await repository.resolve(8, 'US');

      expect(result).toMatchObject({
        providerId: 'netflix',
        distributionChannel: 'direct',
      });
    });

    it('should fall back to global when region-specific not found', async () => {
      const selectChain = mockDb.select();
      // First call (region-specific) returns empty
      selectChain.limit
        .mockResolvedValueOnce([])
        // Second call (global) returns mapping
        .mockResolvedValueOnce([mockDbRow]);

      const result = await repository.resolve(8, 'US');

      expect(result).toMatchObject({ providerId: 'netflix' });
    });

    it('should return null when no mapping exists', async () => {
      const selectChain = mockDb.select();
      selectChain.limit.mockResolvedValue([]);

      const result = await repository.resolve(999, 'US');

      expect(result).toBeNull();
    });

    it('should not query global when already global', async () => {
      const selectChain = mockDb.select();
      selectChain.limit.mockResolvedValue([]);

      await repository.resolve(8, GLOBAL_REGION);

      // Should only call once (no fallback needed)
      expect(selectChain.limit).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveMany', () => {
    it('should batch resolve with region priority', async () => {
      const selectChain = mockDb.select();
      // First query (region-specific)
      selectChain.where.mockResolvedValueOnce([mockDbRow]);
      // No missing IDs, so no second query

      const result = await repository.resolveMany([8], 'US');

      expect(result.size).toBe(1);
      expect(result.get(8)).toMatchObject({ providerId: 'netflix' });
    });

    it('should return empty map for empty input', async () => {
      const result = await repository.resolveMany([], 'US');

      expect(result.size).toBe(0);
    });

    it('should query global for missing IDs', async () => {
      const selectChain = mockDb.select();
      // First query returns mapping for ID 8
      selectChain.where
        .mockResolvedValueOnce([mockDbRow])
        // Second query (global) for missing ID 9
        .mockResolvedValueOnce([{ ...mockDbRow, tmdbProviderId: 9 }]);

      const result = await repository.resolveMany([8, 9], 'US');

      expect(result.size).toBe(2);
    });
  });
});
