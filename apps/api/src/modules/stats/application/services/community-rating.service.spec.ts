import { Test } from '@nestjs/testing';

import {
  COMMUNITY_RATING_AGGREGATION_PORT,
  type ICommunityRatingAggregationPort,
} from '../../domain/ports/community-rating-aggregation.port';
import {
  STATS_REPOSITORY,
  type IStatsRepository,
} from '../../domain/repositories/stats.repository.interface';

import { CommunityRatingService } from './community-rating.service';

describe('CommunityRatingService', () => {
  let service: CommunityRatingService;
  let aggregationPort: jest.Mocked<ICommunityRatingAggregationPort>;
  let statsRepository: jest.Mocked<IStatsRepository>;

  beforeEach(async () => {
    const mockAggregationPort: jest.Mocked<ICommunityRatingAggregationPort> = {
      aggregateForMediaItem: jest.fn(),
      aggregateAll: jest.fn(),
      findMediaItemIdsWithCommunityRatings: jest.fn().mockResolvedValue([]),
    };

    const mockStatsRepository: jest.Mocked<IStatsRepository> = {
      upsert: jest.fn(),
      bulkUpsert: jest.fn(),
      findByMediaItemId: jest.fn(),
      findByTmdbId: jest.fn(),
      updateTotalWatchers: jest.fn(),
      updateWatchersCount: jest.fn(),
      updateCommunityRating: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CommunityRatingService,
        { provide: COMMUNITY_RATING_AGGREGATION_PORT, useValue: mockAggregationPort },
        { provide: STATS_REPOSITORY, useValue: mockStatsRepository },
      ],
    }).compile();

    service = module.get(CommunityRatingService);
    aggregationPort = module.get(COMMUNITY_RATING_AGGREGATION_PORT);
    statsRepository = module.get(STATS_REPOSITORY);
  });

  describe('recalculateForMediaItem', () => {
    const mediaItemId = 'media-123';

    it('should update community rating when ratings exist', async () => {
      aggregationPort.aggregateForMediaItem.mockResolvedValue({
        averageRating: 75.333,
        ratingCount: 10,
      });

      await service.recalculateForMediaItem(mediaItemId);

      expect(aggregationPort.aggregateForMediaItem).toHaveBeenCalledWith(mediaItemId);
      expect(statsRepository.updateCommunityRating).toHaveBeenCalledWith(mediaItemId, 75.33, 10);
    });

    it('should reset to zero when no ratings exist (null result)', async () => {
      aggregationPort.aggregateForMediaItem.mockResolvedValue(null);

      await service.recalculateForMediaItem(mediaItemId);

      expect(statsRepository.updateCommunityRating).toHaveBeenCalledWith(mediaItemId, 0, 0);
    });

    it('should reset to zero when rating count is 0', async () => {
      aggregationPort.aggregateForMediaItem.mockResolvedValue({
        averageRating: 0,
        ratingCount: 0,
      });

      await service.recalculateForMediaItem(mediaItemId);

      expect(statsRepository.updateCommunityRating).toHaveBeenCalledWith(mediaItemId, 0, 0);
    });

    it('should round average rating to 2 decimal places', async () => {
      aggregationPort.aggregateForMediaItem.mockResolvedValue({
        averageRating: 82.6666666667,
        ratingCount: 3,
      });

      await service.recalculateForMediaItem(mediaItemId);

      expect(statsRepository.updateCommunityRating).toHaveBeenCalledWith(mediaItemId, 82.67, 3);
    });

    it('should handle exact integer averages', async () => {
      aggregationPort.aggregateForMediaItem.mockResolvedValue({
        averageRating: 80,
        ratingCount: 5,
      });

      await service.recalculateForMediaItem(mediaItemId);

      expect(statsRepository.updateCommunityRating).toHaveBeenCalledWith(mediaItemId, 80, 5);
    });
  });

  describe('reconcileAll', () => {
    it('should return updated count of zero for empty aggregation map', async () => {
      aggregationPort.aggregateAll.mockResolvedValue(new Map());

      const result = await service.reconcileAll();

      expect(result).toEqual({ updated: 0, reset: 0 });
      expect(statsRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should bulk upsert aggregations for multiple items', async () => {
      const aggregations = new Map([
        ['media-1', { averageRating: 85.555, ratingCount: 20 }],
        ['media-2', { averageRating: 60.123, ratingCount: 5 }],
        ['media-3', { averageRating: 92, ratingCount: 100 }],
      ]);
      aggregationPort.aggregateAll.mockResolvedValue(aggregations);
      aggregationPort.findMediaItemIdsWithCommunityRatings.mockResolvedValue([
        'media-1',
        'media-2',
        'media-3',
      ]);

      const result = await service.reconcileAll();

      expect(result).toEqual({ updated: 3, reset: 0 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        { mediaItemId: 'media-1', communityAverageRating: 85.56, communityRatingCount: 20 },
        { mediaItemId: 'media-2', communityAverageRating: 60.12, communityRatingCount: 5 },
        { mediaItemId: 'media-3', communityAverageRating: 92, communityRatingCount: 100 },
      ]);
    });

    it('should round averages to 2 decimal places in bulk', async () => {
      const aggregations = new Map([['media-1', { averageRating: 33.3333333, ratingCount: 3 }]]);
      aggregationPort.aggregateAll.mockResolvedValue(aggregations);
      aggregationPort.findMediaItemIdsWithCommunityRatings.mockResolvedValue(['media-1']);

      await service.reconcileAll();

      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        { mediaItemId: 'media-1', communityAverageRating: 33.33, communityRatingCount: 3 },
      ]);
    });

    it('should reset stale community ratings for items with no remaining user ratings', async () => {
      const aggregations = new Map([['media-1', { averageRating: 80, ratingCount: 5 }]]);
      aggregationPort.aggregateAll.mockResolvedValue(aggregations);
      aggregationPort.findMediaItemIdsWithCommunityRatings.mockResolvedValue([
        'media-1',
        'media-stale-1',
        'media-stale-2',
      ]);

      const result = await service.reconcileAll();

      expect(result).toEqual({ updated: 1, reset: 2 });
      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        { mediaItemId: 'media-stale-1', communityAverageRating: 0, communityRatingCount: 0 },
        { mediaItemId: 'media-stale-2', communityAverageRating: 0, communityRatingCount: 0 },
      ]);
    });

    it('should not reset any ratings when all existing items have fresh ratings', async () => {
      const aggregations = new Map([['media-1', { averageRating: 70, ratingCount: 3 }]]);
      aggregationPort.aggregateAll.mockResolvedValue(aggregations);
      aggregationPort.findMediaItemIdsWithCommunityRatings.mockResolvedValue(['media-1']);

      const result = await service.reconcileAll();

      expect(result).toEqual({ updated: 1, reset: 0 });
      // bulkUpsert called only once (for fresh items), no second call for stale resets
      expect(statsRepository.bulkUpsert).toHaveBeenCalledTimes(1);
    });
  });
});
