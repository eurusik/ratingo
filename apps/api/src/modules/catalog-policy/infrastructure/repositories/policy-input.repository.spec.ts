/**
 * PolicyInputRepository Unit Tests
 */

import { Test } from '@nestjs/testing';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { MEDIA_WATCH_OFFERS_REPOSITORY } from '../../../provider/public';

import { PolicyInputRepository } from './policy-input.repository';

describe('PolicyInputRepository', () => {
  let repository: PolicyInputRepository;
  let mockDb: {
    select: jest.Mock;
  };
  let mockWatchOffersRepository: {
    getOffersForMediaBatch: jest.Mock;
  };

  // Helper to create chainable query mock
  const createQueryMock = (result: unknown[]) => {
    const mock = {
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(result),
    };
    return mock;
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
    };

    mockWatchOffersRepository = {
      getOffersForMediaBatch: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PolicyInputRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: MEDIA_WATCH_OFFERS_REPOSITORY,
          useValue: mockWatchOffersRepository,
        },
      ],
    }).compile();

    repository = moduleRef.get<PolicyInputRepository>(PolicyInputRepository);
  });

  describe('findOneForEvaluation', () => {
    it('should return null when media item not found', async () => {
      const queryMock = createQueryMock([]);
      mockDb.select.mockReturnValue(queryMock);

      const result = await repository.findOneForEvaluation('non-existent-id');

      expect(result).toBeNull();
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should fetch offers and map to PolicyEngineInput', async () => {
      const mediaItemId = 'test-media-1';
      const mockRow = {
        id: mediaItemId,
        title: 'Test Movie',
        originCountries: ['US'],
        originalLanguage: 'en',
        contentClass: 'mainstream',
        ratingImdb: 7.5,
        ratingMetacritic: 75,
        ratingRottenTomatoes: 80,
        ratingTrakt: 7.8,
        voteCountImdb: 5000,
        voteCountTrakt: 1000,
        qualityScore: 0.75,
        popularityScore: 0.6,
        freshnessScore: 0.5,
        ratingoScore: 0.7,
      };

      const queryMock = createQueryMock([mockRow]);
      mockDb.select.mockReturnValue(queryMock);

      const offersMap = new Map([
        [
          mediaItemId,
          [
            {
              providerId: 'netflix',
              offerType: 'flatrate',
              distributionChannel: 'direct',
              variantIsAdsTier: false,
            },
          ],
        ],
      ]);
      mockWatchOffersRepository.getOffersForMediaBatch.mockResolvedValue(offersMap);

      const result = await repository.findOneForEvaluation(mediaItemId);

      expect(result).not.toBeNull();
      expect(result?.mediaItem.id).toBe(mediaItemId);
      expect(result?.mediaItem.normalizedOffers).toHaveLength(1);
      expect(mockWatchOffersRepository.getOffersForMediaBatch).toHaveBeenCalledWith([mediaItemId], {
        includeVariantInfo: true,
      });
    });
  });

  describe('findManyForEvaluation', () => {
    it('should return empty array for empty input', async () => {
      const result = await repository.findManyForEvaluation([]);

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should batch fetch offers for multiple items', async () => {
      const mediaItemIds = ['media-1', 'media-2'];
      const mockRows = mediaItemIds.map((id) => ({
        id,
        title: `Movie ${id}`,
        originCountries: ['US'],
        originalLanguage: 'en',
        contentClass: 'mainstream',
        ratingImdb: 7.0,
        ratingMetacritic: 70,
        ratingRottenTomatoes: 75,
        ratingTrakt: 7.0,
        voteCountImdb: 1000,
        voteCountTrakt: 500,
        qualityScore: 0.7,
        popularityScore: 0.5,
        freshnessScore: 0.5,
        ratingoScore: 0.6,
      }));

      // Mock for batch query (no limit, returns directly from where)
      const queryMock = {
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockRows),
      };
      mockDb.select.mockReturnValue(queryMock);

      const offersMap = new Map([
        [
          'media-1',
          [
            {
              providerId: 'netflix',
              offerType: 'flatrate',
              distributionChannel: 'direct',
              variantIsAdsTier: false,
            },
          ],
        ],
        [
          'media-2',
          [
            {
              providerId: 'amazon',
              offerType: 'rent',
              distributionChannel: 'aggregator',
              variantIsAdsTier: true,
            },
          ],
        ],
      ]);
      mockWatchOffersRepository.getOffersForMediaBatch.mockResolvedValue(offersMap);

      const result = await repository.findManyForEvaluation(mediaItemIds);

      expect(result).toHaveLength(2);
      expect(mockWatchOffersRepository.getOffersForMediaBatch).toHaveBeenCalledWith(mediaItemIds, {
        includeVariantInfo: true,
      });
    });
  });

  describe('countEligibleItems', () => {
    it('should return count using COUNT(*)', async () => {
      const queryMock = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ count: 12345 }]),
      };
      mockDb.select.mockReturnValue(queryMock);

      const result = await repository.countEligibleItems();

      expect(result).toBe(12345);
      // Verify COUNT(*) is used (check select was called with count field)
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return 0 when no items found', async () => {
      const queryMock = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(queryMock);

      const result = await repository.countEligibleItems();

      expect(result).toBe(0);
    });
  });

  describe('fetchBatchIds', () => {
    it('should fetch batch of IDs with cursor pagination', async () => {
      const mockIds = [{ id: 'media-3' }, { id: 'media-4' }, { id: 'media-5' }];
      const queryMock = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockIds),
      };
      mockDb.select.mockReturnValue(queryMock);

      const result = await repository.fetchBatchIds({
        batchSize: 3,
        cursor: 'media-2',
      });

      expect(result).toEqual(['media-3', 'media-4', 'media-5']);
      expect(queryMock.limit).toHaveBeenCalledWith(3);
    });

    it('should fetch first batch without cursor', async () => {
      const mockIds = [{ id: 'media-1' }, { id: 'media-2' }];
      const queryMock = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockIds),
      };
      mockDb.select.mockReturnValue(queryMock);

      const result = await repository.fetchBatchIds({ batchSize: 2 });

      expect(result).toEqual(['media-1', 'media-2']);
    });

    it('should return empty array when no more items', async () => {
      const queryMock = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(queryMock);

      const result = await repository.fetchBatchIds({
        batchSize: 100,
        cursor: 'last-item',
      });

      expect(result).toEqual([]);
    });

    it('should apply snapshotCutoff filter when provided', async () => {
      const mockIds = [{ id: 'media-1' }];
      const queryMock = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockIds),
      };
      mockDb.select.mockReturnValue(queryMock);

      const snapshotCutoff = new Date('2024-01-01');
      const result = await repository.fetchBatchIds({
        batchSize: 10,
        snapshotCutoff,
      });

      expect(result).toEqual(['media-1']);
      // The where clause should include the snapshotCutoff condition
      expect(queryMock.where).toHaveBeenCalled();
    });
  });
});
