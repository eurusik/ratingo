import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import {
  CreateWatchOfferInput,
  MEDIA_WATCH_OFFERS_REPOSITORY,
} from '../../domain/repositories/media-watch-offers.repository.interface';
import { MediaWatchOffersRepository } from './media-watch-offers.repository';

describe('MediaWatchOffersRepository', () => {
  let repository: MediaWatchOffersRepository;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    delete: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    values: jest.Mock;
    transaction: jest.Mock;
    leftJoin: jest.Mock;
  };

  const createMockDbRow = (overrides?: Partial<ReturnType<typeof createMockDbRow>>) => ({
    id: 'offer-123',
    mediaItemId: 'media-123',
    providerId: 'netflix',
    variantId: null,
    distributionChannel: 'direct' as const,
    offerType: 'flatrate' as const,
    region: 'US',
    link: 'https://netflix.com/watch/123',
    tmdbProviderId: 8,
    updatedAt: new Date('2024-01-15'),
    ...overrides,
  });

  const createOfferInput = (overrides?: Partial<CreateWatchOfferInput>): CreateWatchOfferInput => ({
    mediaItemId: 'media-123',
    providerId: 'netflix',
    variantId: null,
    distributionChannel: 'direct',
    offerType: 'flatrate',
    region: 'US',
    link: 'https://netflix.com/watch/123',
    tmdbProviderId: 8,
    ...overrides,
  });

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn(),
      values: jest.fn(),
      transaction: jest.fn(),
      leftJoin: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MEDIA_WATCH_OFFERS_REPOSITORY,
          useClass: MediaWatchOffersRepository,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<MediaWatchOffersRepository>(MEDIA_WATCH_OFFERS_REPOSITORY);
  });

  describe('upsertMany', () => {
    it('should do nothing for empty offers', async () => {
      // Act
      await repository.upsertMany('media-123', 'US', []);

      // Assert
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should delete existing and insert new offers in transaction', async () => {
      // Arrange
      const mockTx = {
        delete: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
        values: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.transaction.mockImplementation(async (fn) => fn(mockTx));

      const offers = [
        createOfferInput({ providerId: 'netflix' }),
        createOfferInput({ providerId: 'prime_video', tmdbProviderId: 9 }),
      ];

      // Act
      await repository.upsertMany('media-123', 'US', offers);

      // Assert
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.delete).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockTx.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ providerId: 'netflix' }),
          expect.objectContaining({ providerId: 'prime_video' }),
        ]),
      );
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.transaction.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.upsertMany('media-123', 'US', [createOfferInput()])).rejects.toThrow(
        'DB Error',
      );
    });
  });

  describe('upsertManyByRegions', () => {
    it('should do nothing for empty offers', async () => {
      // Act
      await repository.upsertManyByRegions('media-123', []);

      // Assert
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should group offers by region and upsert each', async () => {
      // Arrange
      const mockTx = {
        delete: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
        values: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.transaction.mockImplementation(async (fn) => fn(mockTx));

      const offers = [
        createOfferInput({ region: 'US' }),
        createOfferInput({ region: 'US', providerId: 'prime_video' }),
        createOfferInput({ region: 'GB' }),
      ];

      // Act
      await repository.upsertManyByRegions('media-123', offers);

      // Assert - should have 2 transactions (one per region)
      expect(mockDb.transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByMediaItemId', () => {
    it('should return offers for media item', async () => {
      // Arrange
      const mockRows = [
        createMockDbRow({ providerId: 'netflix' }),
        createMockDbRow({ providerId: 'prime_video', tmdbProviderId: 9 }),
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findByMediaItemId('media-123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].providerId).toBe('netflix');
      expect(result[1].providerId).toBe('prime_video');
    });

    it('should filter by offer types', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      await repository.findByMediaItemId('media-123', { offerTypes: ['flatrate', 'rent'] });

      // Assert
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by distribution channels', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      await repository.findByMediaItemId('media-123', { distributionChannels: ['direct'] });

      // Assert
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by region', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      await repository.findByMediaItemId('media-123', { region: 'US' });

      // Assert
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return empty array when no offers found', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findByMediaItemId('media-123');

      // Assert
      expect(result).toEqual([]);
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findByMediaItemId('media-123')).rejects.toThrow('DB Error');
    });
  });

  describe('findByTmdbProviderId', () => {
    it('should return offers for TMDB provider ID', async () => {
      // Arrange
      const mockRows = [
        createMockDbRow({ mediaItemId: 'media-1' }),
        createMockDbRow({ mediaItemId: 'media-2' }),
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findByTmdbProviderId(8);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return empty array when no offers found', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findByTmdbProviderId(999);

      // Assert
      expect(result).toEqual([]);
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findByTmdbProviderId(8)).rejects.toThrow('DB Error');
    });
  });

  describe('findByMediaItemIds', () => {
    it('should return empty map for empty input', async () => {
      // Act
      const result = await repository.findByMediaItemIds([]);

      // Assert
      expect(result.size).toBe(0);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should return offers grouped by media item', async () => {
      // Arrange
      const mockRows = [
        createMockDbRow({ mediaItemId: 'media-1', providerId: 'netflix' }),
        createMockDbRow({ mediaItemId: 'media-1', providerId: 'prime_video' }),
        createMockDbRow({ mediaItemId: 'media-2', providerId: 'disney_plus' }),
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findByMediaItemIds(['media-1', 'media-2']);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('media-1')).toHaveLength(2);
      expect(result.get('media-2')).toHaveLength(1);
    });

    it('should apply filters', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      await repository.findByMediaItemIds(['media-1'], {
        offerTypes: ['flatrate'],
        distributionChannels: ['direct'],
        region: 'US',
      });

      // Assert
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.findByMediaItemIds(['media-1'])).rejects.toThrow('DB Error');
    });
  });

  describe('deleteByMediaItemId', () => {
    it('should delete all offers for media item', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.deleteByMediaItemId('media-123');

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.deleteByMediaItemId('media-123')).rejects.toThrow('DB Error');
    });
  });

  describe('deleteByMediaItemIdAndRegion', () => {
    it('should delete offers for media item and region', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.deleteByMediaItemIdAndRegion('media-123', 'US');

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.deleteByMediaItemIdAndRegion('media-123', 'US')).rejects.toThrow(
        'DB Error',
      );
    });
  });

  describe('getOffersForMediaBatch', () => {
    it('should return empty map for empty input', async () => {
      // Act
      const result = await repository.getOffersForMediaBatch([]);

      // Assert
      expect(result.size).toBe(0);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should return offer views grouped by media item without variant info', async () => {
      // Arrange
      const mockRows = [
        {
          mediaItemId: 'media-1',
          providerId: 'netflix',
          offerType: 'flatrate',
          distributionChannel: 'direct',
        },
        {
          mediaItemId: 'media-1',
          providerId: 'prime_video',
          offerType: 'rent',
          distributionChannel: 'direct',
        },
        {
          mediaItemId: 'media-2',
          providerId: 'disney_plus',
          offerType: 'flatrate',
          distributionChannel: 'direct',
        },
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.getOffersForMediaBatch(['media-1', 'media-2']);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('media-1')).toHaveLength(2);
      expect(result.get('media-2')).toHaveLength(1);
      expect(result.get('media-1')![0]).toEqual({
        providerId: 'netflix',
        offerType: 'flatrate',
        distributionChannel: 'direct',
      });
    });

    it('should return offer views with variant info when includeVariantInfo = true', async () => {
      // Arrange
      const mockRows = [
        {
          mediaItemId: 'media-1',
          providerId: 'netflix',
          offerType: 'flatrate',
          distributionChannel: 'direct',
          variantId: 'netflix_ads',
          isAdsTier: true,
        },
        {
          mediaItemId: 'media-1',
          providerId: 'netflix',
          offerType: 'flatrate',
          distributionChannel: 'direct',
          variantId: 'netflix_standard',
          isAdsTier: false,
        },
        {
          mediaItemId: 'media-2',
          providerId: 'prime_video',
          offerType: 'flatrate',
          distributionChannel: 'direct',
          variantId: null,
          isAdsTier: null,
        },
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.getOffersForMediaBatch(['media-1', 'media-2'], {
        includeVariantInfo: true,
      });

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('media-1')).toHaveLength(2);
      expect(result.get('media-1')![0]).toEqual({
        providerId: 'netflix',
        offerType: 'flatrate',
        distributionChannel: 'direct',
        variantIsAdsTier: true,
      });
      expect(result.get('media-1')![1]).toEqual({
        providerId: 'netflix',
        offerType: 'flatrate',
        distributionChannel: 'direct',
        variantIsAdsTier: false,
      });
      // null variant = not ads tier
      expect(result.get('media-2')![0].variantIsAdsTier).toBe(false);
      expect(mockDb.leftJoin).toHaveBeenCalled();
    });

    it('should apply offer type filters', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      await repository.getOffersForMediaBatch(['media-1'], {
        offerTypes: ['flatrate', 'rent'],
      });

      // Assert
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply distribution channel filters', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      await repository.getOffersForMediaBatch(['media-1'], {
        distributionChannels: ['direct'],
      });

      // Assert
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should log and rethrow on error', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(repository.getOffersForMediaBatch(['media-1'])).rejects.toThrow('DB Error');
    });
  });
});
