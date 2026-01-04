/**
 * Provider Mapping Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { ErrorCode } from '../../../../common/enums/error-code.enum';
import { NotFoundException } from '../../../../common/exceptions';
import { PROVIDER_MAPPING_REPOSITORY } from '../../domain/repositories/provider-mapping.repository.interface';
import type { ProviderMapping, ResolvedMapping } from '../../domain/types/provider.types';
import { ProviderMappingService } from './provider-mapping.service';

describe('ProviderMappingService', () => {
  let service: ProviderMappingService;
  let mockRepository: {
    findById: jest.Mock;
    findByRegion: jest.Mock;
    findByTmdbIdAndRegion: jest.Mock;
    findManyByTmdbIdsAndRegion: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    resolve: jest.Mock;
    resolveMany: jest.Mock;
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
    createdAt: new Date(),
  };

  const mockResolved: ResolvedMapping = {
    providerId: 'netflix',
    variantId: null,
    distributionChannel: 'direct',
  };

  beforeEach(async () => {
    mockRepository = {
      findById: jest.fn(),
      findByRegion: jest.fn(),
      findByTmdbIdAndRegion: jest.fn(),
      findManyByTmdbIdsAndRegion: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      resolve: jest.fn(),
      resolveMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderMappingService,
        { provide: PROVIDER_MAPPING_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ProviderMappingService>(ProviderMappingService);
  });

  describe('resolve', () => {
    it('should resolve TMDB ID to canonical mapping', async () => {
      mockRepository.resolve.mockResolvedValue(mockResolved);

      const result = await service.resolve(8, 'US');

      expect(result).toEqual(mockResolved);
      expect(mockRepository.resolve).toHaveBeenCalledWith(8, 'US');
    });

    it('should return null when no mapping exists', async () => {
      mockRepository.resolve.mockResolvedValue(null);

      const result = await service.resolve(999, 'US');

      expect(result).toBeNull();
    });

    it('should normalize region to uppercase', async () => {
      mockRepository.resolve.mockResolvedValue(mockResolved);

      await service.resolve(8, 'us');

      expect(mockRepository.resolve).toHaveBeenCalledWith(8, 'US');
    });

    it('should use global for undefined region', async () => {
      mockRepository.resolve.mockResolvedValue(mockResolved);

      await service.resolve(8);

      expect(mockRepository.resolve).toHaveBeenCalledWith(8, 'global');
    });
  });

  describe('resolveMany', () => {
    it('should batch resolve multiple TMDB IDs', async () => {
      const resolvedMap = new Map<number, ResolvedMapping>([
        [8, mockResolved],
        [9, { providerId: 'prime_video', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockRepository.resolveMany.mockResolvedValue(resolvedMap);

      const result = await service.resolveMany([8, 9], 'US');

      expect(result.size).toBe(2);
      expect(result.get(8)).toEqual(mockResolved);
      expect(mockRepository.resolveMany).toHaveBeenCalledWith([8, 9], 'US');
    });

    it('should return empty map for empty input', async () => {
      const result = await service.resolveMany([], 'US');

      expect(result.size).toBe(0);
      expect(mockRepository.resolveMany).not.toHaveBeenCalled();
    });
  });

  describe('getUnmappedIds', () => {
    it('should return IDs that have no mapping', async () => {
      const resolvedMap = new Map<number, ResolvedMapping>([[8, mockResolved]]);
      mockRepository.resolveMany.mockResolvedValue(resolvedMap);

      const result = await service.getUnmappedIds([8, 9, 10], 'US');

      expect(result).toEqual([9, 10]);
    });

    it('should return empty array when all are mapped', async () => {
      const resolvedMap = new Map<number, ResolvedMapping>([
        [8, mockResolved],
        [9, mockResolved],
      ]);
      mockRepository.resolveMany.mockResolvedValue(resolvedMap);

      const result = await service.getUnmappedIds([8, 9], 'US');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return mapping when found', async () => {
      mockRepository.findById.mockResolvedValue(mockMapping);

      const result = await service.findById('mapping-1');

      expect(result).toEqual(mockMapping);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByRegion', () => {
    it('should return mappings for region', async () => {
      mockRepository.findByRegion.mockResolvedValue([mockMapping]);

      const result = await service.findByRegion('global');

      expect(result).toEqual([mockMapping]);
      expect(mockRepository.findByRegion).toHaveBeenCalledWith('global');
    });

    it('should normalize region', async () => {
      mockRepository.findByRegion.mockResolvedValue([]);

      await service.findByRegion('us');

      expect(mockRepository.findByRegion).toHaveBeenCalledWith('US');
    });
  });

  describe('findByTmdbIdAndRegion', () => {
    it('should return mapping when found', async () => {
      mockRepository.findByTmdbIdAndRegion.mockResolvedValue(mockMapping);

      const result = await service.findByTmdbIdAndRegion(8, 'global');

      expect(result).toEqual(mockMapping);
    });

    it('should return null when not found', async () => {
      mockRepository.findByTmdbIdAndRegion.mockResolvedValue(null);

      const result = await service.findByTmdbIdAndRegion(999, 'global');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create mapping', async () => {
      mockRepository.create.mockResolvedValue(mockMapping);

      const result = await service.create({
        tmdbProviderId: 8,
        providerId: 'netflix',
      });

      expect(result).toEqual(mockMapping);
      expect(mockRepository.create).toHaveBeenCalledWith({
        tmdbProviderId: 8,
        providerId: 'netflix',
      });
    });
  });

  describe('update', () => {
    it('should update mapping when exists', async () => {
      mockRepository.findById.mockResolvedValue(mockMapping);
      mockRepository.update.mockResolvedValue({ ...mockMapping, providerId: 'prime_video' });

      const result = await service.update('mapping-1', { providerId: 'prime_video' });

      expect(result?.providerId).toBe('prime_video');
    });

    it('should return null when not exists', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.update('unknown', { providerId: 'netflix' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete mapping when exists', async () => {
      mockRepository.findById.mockResolvedValue(mockMapping);
      mockRepository.delete.mockResolvedValue(undefined);

      const result = await service.delete('mapping-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('mapping-1');
    });

    it('should return false when not exists', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.delete('unknown');

      expect(result).toBe(false);
    });
  });
});
