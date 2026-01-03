import { Test, TestingModule } from '@nestjs/testing';

import {
  IMediaWatchOffersRepository,
  MEDIA_WATCH_OFFERS_REPOSITORY,
} from '../../domain/repositories/media-watch-offers.repository.interface';
import {
  IUnmappedTrackingRepository,
  UNMAPPED_TRACKING_REPOSITORY,
} from '../../domain/repositories/unmapped-tracking.repository.interface';
import type { ResolvedMapping } from '../../domain/types/provider.types';
import { NormalizationService, WatchProvidersMap } from './normalization.service';
import { ProviderMappingService } from './provider-mapping.service';

describe('NormalizationService', () => {
  let service: NormalizationService;
  let mockMappingService: jest.Mocked<ProviderMappingService>;
  let mockOffersRepository: jest.Mocked<IMediaWatchOffersRepository>;
  let mockUnmappedRepository: jest.Mocked<IUnmappedTrackingRepository>;

  beforeEach(async () => {
    mockMappingService = {
      resolve: jest.fn(),
      resolveMany: jest.fn().mockResolvedValue(new Map()),
      findById: jest.fn(),
      findByRegion: jest.fn(),
      findByTmdbIdAndRegion: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getUnmappedIds: jest.fn(),
    } as unknown as jest.Mocked<ProviderMappingService>;

    mockOffersRepository = {
      upsertMany: jest.fn().mockResolvedValue(undefined),
      upsertManyByRegions: jest.fn().mockResolvedValue(undefined),
      findByMediaItemId: jest.fn().mockResolvedValue([]),
      findByTmdbProviderId: jest.fn().mockResolvedValue([]),
      findByMediaItemIds: jest.fn().mockResolvedValue(new Map()),
      getOffersForMediaBatch: jest.fn().mockResolvedValue(new Map()),
      deleteByMediaItemId: jest.fn().mockResolvedValue(undefined),
      deleteByMediaItemIdAndRegion: jest.fn().mockResolvedValue(undefined),
    };

    mockUnmappedRepository = {
      recordUnmapped: jest.fn().mockResolvedValue(undefined),
      recordUnmappedBatch: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn().mockResolvedValue([]),
      findByTmdbId: jest.fn().mockResolvedValue(null),
      removeByTmdbId: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NormalizationService,
        {
          provide: ProviderMappingService,
          useValue: mockMappingService,
        },
        {
          provide: MEDIA_WATCH_OFFERS_REPOSITORY,
          useValue: mockOffersRepository,
        },
        {
          provide: UNMAPPED_TRACKING_REPOSITORY,
          useValue: mockUnmappedRepository,
        },
      ],
    }).compile();

    service = module.get<NormalizationService>(NormalizationService);
  });

  describe('normalizeWatchProviders', () => {
    it('should create offers for mapped providers', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          link: 'https://tmdb.org/watch/123',
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix' },
            { provider_id: 9, provider_name: 'Prime Video' },
          ],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
        [9, { providerId: 'prime_video', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(result.offersCreated).toBe(2);
      expect(result.unmappedCount).toBe(0);
      expect(mockOffersRepository.upsertManyByRegions).toHaveBeenCalledWith(
        'media-123',
        expect.arrayContaining([
          expect.objectContaining({
            providerId: 'netflix',
            offerType: 'flatrate',
            region: 'US',
            tmdbProviderId: 8,
          }),
          expect.objectContaining({
            providerId: 'prime_video',
            offerType: 'flatrate',
            region: 'US',
            tmdbProviderId: 9,
          }),
        ]),
      );
    });

    it('should record unmapped providers', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ provider_id: 999, provider_name: 'Unknown Provider' }],
        },
      };

      mockMappingService.resolveMany.mockResolvedValue(new Map());

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(result.offersCreated).toBe(0);
      expect(result.unmappedCount).toBe(1);
      expect(mockUnmappedRepository.recordUnmappedBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          tmdbProviderId: 999,
          providerName: 'Unknown Provider',
          region: 'US',
        }),
      ]);
    });

    it('should handle multiple offer types', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
          rent: [{ provider_id: 8, provider_name: 'Netflix' }],
          buy: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(result.offersCreated).toBe(3);
      expect(mockOffersRepository.upsertManyByRegions).toHaveBeenCalledWith(
        'media-123',
        expect.arrayContaining([
          expect.objectContaining({ offerType: 'flatrate' }),
          expect.objectContaining({ offerType: 'rent' }),
          expect.objectContaining({ offerType: 'buy' }),
        ]),
      );
    });

    it('should handle multiple regions', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
        GB: {
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(result.offersCreated).toBe(2);
      expect(mockMappingService.resolveMany).toHaveBeenCalledTimes(2);
    });

    it('should normalize region codes', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        us: {
          // lowercase
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(mockOffersRepository.upsertManyByRegions).toHaveBeenCalledWith(
        'media-123',
        expect.arrayContaining([expect.objectContaining({ region: 'US' })]),
      );
    });

    it('should preserve link from region data', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          link: 'https://tmdb.org/watch/123',
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(mockOffersRepository.upsertManyByRegions).toHaveBeenCalledWith(
        'media-123',
        expect.arrayContaining([expect.objectContaining({ link: 'https://tmdb.org/watch/123' })]),
      );
    });

    it('should preserve tmdbProviderId for traceability', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(mockOffersRepository.upsertManyByRegions).toHaveBeenCalledWith(
        'media-123',
        expect.arrayContaining([expect.objectContaining({ tmdbProviderId: 8 })]),
      );
    });

    it('should handle empty providers', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {};

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(result.offersCreated).toBe(0);
      expect(result.unmappedCount).toBe(0);
      expect(mockOffersRepository.upsertManyByRegions).not.toHaveBeenCalled();
      expect(mockUnmappedRepository.recordUnmappedBatch).not.toHaveBeenCalled();
    });

    it('should handle mixed mapped and unmapped providers', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix' },
            { provider_id: 999, provider_name: 'Unknown' },
          ],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert
      expect(result.offersCreated).toBe(1);
      expect(result.unmappedCount).toBe(1);
    });
  });

  describe('normalizeBatch', () => {
    it('should process multiple items', async () => {
      // Arrange
      const items = [
        { mediaItemId: 'media-1', rawProviders: {} },
        { mediaItemId: 'media-2', rawProviders: {} },
      ];

      // Act
      const result = await service.normalizeBatch(items);

      // Assert
      expect(result.processed).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should continue on error and count errors', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
      };

      const items = [
        { mediaItemId: 'media-1', rawProviders },
        { mediaItemId: 'media-2', rawProviders },
      ];

      // First call succeeds, second fails
      mockMappingService.resolveMany
        .mockResolvedValueOnce(new Map())
        .mockRejectedValueOnce(new Error('DB Error'));

      // Act
      const result = await service.normalizeBatch(items);

      // Assert
      expect(result.processed).toBe(1);
      expect(result.errors).toBe(1);
    });

    it('should aggregate results', async () => {
      // Arrange
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        },
      };

      const items = [
        { mediaItemId: 'media-1', rawProviders },
        { mediaItemId: 'media-2', rawProviders },
      ];

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      const result = await service.normalizeBatch(items);

      // Assert
      expect(result.processed).toBe(2);
      expect(result.offersCreated).toBe(2);
    });
  });
});
