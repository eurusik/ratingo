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
import {
  NormalizationService,
  SUPPORTED_OFFER_TYPES,
  SUPPORTED_REGIONS,
  WatchProvidersMap,
} from './normalization.service';
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
            { providerId: 8, name: 'Netflix' },
            { providerId: 9, name: 'Prime Video' },
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
          flatrate: [{ providerId: 999, name: 'Unknown Provider' }],
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
          flatrate: [{ providerId: 8, name: 'Netflix' }],
          rent: [{ providerId: 8, name: 'Netflix' }],
          buy: [{ providerId: 8, name: 'Netflix' }],
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
          flatrate: [{ providerId: 8, name: 'Netflix' }],
        },
        GB: {
          flatrate: [{ providerId: 8, name: 'Netflix' }],
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
          flatrate: [{ providerId: 8, name: 'Netflix' }],
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
          flatrate: [{ providerId: 8, name: 'Netflix' }],
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
          flatrate: [{ providerId: 8, name: 'Netflix' }],
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
            { providerId: 8, name: 'Netflix' },
            { providerId: 999, name: 'Unknown' },
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

    it('should deduplicate identical offers within same region', async () => {
      // Arrange: same provider appears twice in flatrate (TMDB data anomaly)
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [
            { providerId: 8, name: 'Netflix' },
            { providerId: 8, name: 'Netflix' }, // duplicate
          ],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert: only 1 offer created, not 2
      expect(result.offersCreated).toBe(1);
      expect(mockOffersRepository.upsertManyByRegions).toHaveBeenCalledWith(
        'media-123',
        expect.arrayContaining([expect.objectContaining({ providerId: 'netflix' })]),
      );
      const calls = mockOffersRepository.upsertManyByRegions.mock.calls;
      expect(calls[0][1]).toHaveLength(1);
    });

    it('should deduplicate unmapped providers within same region', async () => {
      // Arrange: same unmapped provider in multiple supported offer types (flatrate + free)
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ providerId: 999, name: 'Unknown' }],
          free: [{ providerId: 999, name: 'Unknown' }],
        },
      };

      mockMappingService.resolveMany.mockResolvedValue(new Map());

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert: only 1 unmapped recorded (deduped by region|tmdbProviderId)
      expect(result.unmappedCount).toBe(1);
      expect(mockUnmappedRepository.recordUnmappedBatch).toHaveBeenCalledWith([
        expect.objectContaining({ tmdbProviderId: 999, region: 'US' }),
      ]);
    });

    it('should allow same provider in different offer types', async () => {
      // Arrange: Netflix available for both flatrate and rent (legitimate)
      const rawProviders: WatchProvidersMap = {
        US: {
          flatrate: [{ providerId: 8, name: 'Netflix' }],
          rent: [{ providerId: 8, name: 'Netflix' }],
        },
      };

      const mappings = new Map<number, ResolvedMapping>([
        [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
      ]);
      mockMappingService.resolveMany.mockResolvedValue(mappings);

      // Act
      const result = await service.normalizeWatchProviders('media-123', rawProviders);

      // Assert: 2 offers (different offerType = different dedupe key)
      expect(result.offersCreated).toBe(2);
    });

    describe('unmapped tracking scope', () => {
      it('should not track rent/buy/ads as unmapped even when mapping is missing', async () => {
        // Arrange: unmapped provider in rent/buy/ads only
        const rawProviders: WatchProvidersMap = {
          US: {
            rent: [{ providerId: 999, name: 'Unknown Rental' }],
            buy: [{ providerId: 998, name: 'Unknown Purchase' }],
            ads: [{ providerId: 997, name: 'Unknown Ads' }],
          },
        };

        mockMappingService.resolveMany.mockResolvedValue(new Map());

        // Act
        const result = await service.normalizeWatchProviders('media-123', rawProviders);

        // Assert: no unmapped recorded (rent/buy/ads are not actionable)
        expect(result.unmappedCount).toBe(0);
        expect(mockUnmappedRepository.recordUnmappedBatch).not.toHaveBeenCalled();
      });

      it('should not track regions outside UA/US as unmapped', async () => {
        // Arrange: unmapped provider in GB (not supported)
        const rawProviders: WatchProvidersMap = {
          GB: {
            flatrate: [{ providerId: 999, name: 'Unknown UK Provider' }],
          },
          DE: {
            free: [{ providerId: 998, name: 'Unknown German Provider' }],
          },
        };

        mockMappingService.resolveMany.mockResolvedValue(new Map());

        // Act
        const result = await service.normalizeWatchProviders('media-123', rawProviders);

        // Assert: no unmapped recorded (GB/DE are not supported regions)
        expect(result.unmappedCount).toBe(0);
        expect(mockUnmappedRepository.recordUnmappedBatch).not.toHaveBeenCalled();
      });

      it('should track flatrate/free in UA/US as unmapped when mapping is missing', async () => {
        // Arrange: unmapped providers in supported regions and offer types
        const rawProviders: WatchProvidersMap = {
          UA: {
            flatrate: [{ providerId: 999, name: 'Unknown UA Flatrate' }],
            free: [{ providerId: 998, name: 'Unknown UA Free' }],
          },
          US: {
            flatrate: [{ providerId: 997, name: 'Unknown US Flatrate' }],
          },
        };

        mockMappingService.resolveMany.mockResolvedValue(new Map());

        // Act
        const result = await service.normalizeWatchProviders('media-123', rawProviders);

        // Assert: all 3 unmapped recorded
        expect(result.unmappedCount).toBe(3);
        expect(mockUnmappedRepository.recordUnmappedBatch).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ tmdbProviderId: 999, region: 'UA' }),
            expect.objectContaining({ tmdbProviderId: 998, region: 'UA' }),
            expect.objectContaining({ tmdbProviderId: 997, region: 'US' }),
          ]),
        );
      });

      it('should track unmapped only for supported offer types even in supported regions', async () => {
        // Arrange: mix of supported and unsupported offer types in US
        const rawProviders: WatchProvidersMap = {
          US: {
            flatrate: [{ providerId: 999, name: 'Unknown Flatrate' }],
            free: [{ providerId: 998, name: 'Unknown Free' }],
            rent: [{ providerId: 997, name: 'Unknown Rent' }],
            buy: [{ providerId: 996, name: 'Unknown Buy' }],
          },
        };

        mockMappingService.resolveMany.mockResolvedValue(new Map());

        // Act
        const result = await service.normalizeWatchProviders('media-123', rawProviders);

        // Assert: only flatrate and free tracked (2 unmapped)
        expect(result.unmappedCount).toBe(2);
        expect(mockUnmappedRepository.recordUnmappedBatch).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ tmdbProviderId: 999, providerName: 'Unknown Flatrate' }),
            expect.objectContaining({ tmdbProviderId: 998, providerName: 'Unknown Free' }),
          ]),
        );
      });

      it('should still create offers for all offer types regardless of unmapped tracking scope', async () => {
        // Arrange: mapped provider in all offer types across multiple regions
        const rawProviders: WatchProvidersMap = {
          US: {
            flatrate: [{ providerId: 8, name: 'Netflix' }],
            rent: [{ providerId: 8, name: 'Netflix' }],
            buy: [{ providerId: 8, name: 'Netflix' }],
          },
          GB: {
            flatrate: [{ providerId: 8, name: 'Netflix' }],
          },
        };

        const mappings = new Map<number, ResolvedMapping>([
          [8, { providerId: 'netflix', variantId: null, distributionChannel: 'direct' }],
        ]);
        mockMappingService.resolveMany.mockResolvedValue(mappings);

        // Act
        const result = await service.normalizeWatchProviders('media-123', rawProviders);

        // Assert: all 4 offers created (offers are not filtered by scope)
        expect(result.offersCreated).toBe(4);
        expect(result.unmappedCount).toBe(0);
      });

      it('should export SUPPORTED_REGIONS and SUPPORTED_OFFER_TYPES constants', () => {
        // Assert: constants are exported and have expected values
        expect(SUPPORTED_REGIONS).toEqual(['UA', 'US']);
        expect(SUPPORTED_OFFER_TYPES).toEqual(['flatrate', 'free']);
      });
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
          flatrate: [{ providerId: 8, name: 'Netflix' }],
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
          flatrate: [{ providerId: 8, name: 'Netflix' }],
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
