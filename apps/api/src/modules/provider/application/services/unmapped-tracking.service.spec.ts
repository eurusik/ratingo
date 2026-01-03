import { Test, TestingModule } from '@nestjs/testing';

import {
  IUnmappedTrackingRepository,
  UNMAPPED_TRACKING_REPOSITORY,
} from '../../domain/repositories/unmapped-tracking.repository.interface';
import type { UnmappedProvider } from '../../domain/types/provider.types';
import { UnmappedTrackingService } from './unmapped-tracking.service';

describe('UnmappedTrackingService', () => {
  let service: UnmappedTrackingService;
  let mockRepository: jest.Mocked<IUnmappedTrackingRepository>;

  beforeEach(async () => {
    mockRepository = {
      recordUnmapped: jest.fn().mockResolvedValue(undefined),
      recordUnmappedBatch: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn().mockResolvedValue([]),
      findByTmdbId: jest.fn().mockResolvedValue(null),
      removeByTmdbId: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnmappedTrackingService,
        {
          provide: UNMAPPED_TRACKING_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UnmappedTrackingService>(UnmappedTrackingService);
  });

  describe('recordUnmapped', () => {
    it('should delegate to repository', async () => {
      const input = {
        tmdbProviderId: 8,
        providerName: 'Netflix',
        region: 'US',
      };

      await service.recordUnmapped(input);

      expect(mockRepository.recordUnmapped).toHaveBeenCalledWith(input);
    });

    it('should propagate repository errors', async () => {
      mockRepository.recordUnmapped.mockRejectedValueOnce(new Error('DB Error'));

      await expect(
        service.recordUnmapped({
          tmdbProviderId: 8,
          providerName: 'Netflix',
          region: 'US',
        }),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('recordUnmappedBatch', () => {
    it('should delegate to repository', async () => {
      const inputs = [
        { tmdbProviderId: 8, providerName: 'Netflix', region: 'US' },
        { tmdbProviderId: 9, providerName: 'Prime Video', region: 'US' },
      ];

      await service.recordUnmappedBatch(inputs);

      expect(mockRepository.recordUnmappedBatch).toHaveBeenCalledWith(inputs);
    });

    it('should not call repository for empty input', async () => {
      await service.recordUnmappedBatch([]);

      expect(mockRepository.recordUnmappedBatch).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      mockRepository.recordUnmappedBatch.mockRejectedValueOnce(new Error('DB Error'));

      await expect(
        service.recordUnmappedBatch([{ tmdbProviderId: 8, providerName: 'Netflix', region: 'US' }]),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('findAll', () => {
    it('should return all unmapped providers', async () => {
      const mockProviders: UnmappedProvider[] = [
        createMockUnmapped(8, 'Netflix', 100),
        createMockUnmapped(9, 'Prime Video', 50),
      ];
      mockRepository.findAll.mockResolvedValueOnce(mockProviders);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].tmdbProviderId).toBe(8);
    });

    it('should pass options to repository', async () => {
      await service.findAll({ sortBy: 'lastSeen', limit: 10 });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        sortBy: 'lastSeen',
        limit: 10,
      });
    });

    it('should return empty array when no unmapped providers', async () => {
      mockRepository.findAll.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByTmdbId', () => {
    it('should return unmapped provider when found', async () => {
      const mockProvider = createMockUnmapped(8, 'Netflix', 100);
      mockRepository.findByTmdbId.mockResolvedValueOnce(mockProvider);

      const result = await service.findByTmdbId(8);

      expect(result).not.toBeNull();
      expect(result?.tmdbProviderId).toBe(8);
      expect(mockRepository.findByTmdbId).toHaveBeenCalledWith(8);
    });

    it('should return null when not found', async () => {
      mockRepository.findByTmdbId.mockResolvedValueOnce(null);

      const result = await service.findByTmdbId(999);

      expect(result).toBeNull();
    });
  });

  describe('removeByTmdbId', () => {
    it('should delegate to repository', async () => {
      await service.removeByTmdbId(8);

      expect(mockRepository.removeByTmdbId).toHaveBeenCalledWith(8);
    });

    it('should propagate repository errors', async () => {
      mockRepository.removeByTmdbId.mockRejectedValueOnce(new Error('DB Error'));

      await expect(service.removeByTmdbId(8)).rejects.toThrow('DB Error');
    });
  });
});

// Helper functions

function createMockUnmapped(
  tmdbProviderId: number,
  lastSeenName: string,
  seenCount: number,
): UnmappedProvider {
  return {
    tmdbProviderId,
    lastSeenName,
    sampleNames: [lastSeenName],
    firstSeenAt: new Date('2024-01-01'),
    lastSeenAt: new Date('2024-01-15'),
    seenCount,
    sampleRegions: ['US'],
  };
}
