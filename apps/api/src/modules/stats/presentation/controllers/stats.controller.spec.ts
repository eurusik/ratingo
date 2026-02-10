import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import {
  DropOffService,
  ScoreRecalculationService,
  StatsBackfillService,
  StatsQueryService,
} from '../../application/services';
import { CommunityRatingService } from '../../application/services/community-rating.service';
import { getQueueToken } from '@nestjs/bullmq';
import { STATS_QUEUE, STATS_JOBS } from '../../stats.constants';
import { StatsNotFoundException } from '@/common/exceptions';

describe('StatsController', () => {
  let controller: StatsController;
  let statsQueryService: jest.Mocked<StatsQueryService>;
  let dropOffService: jest.Mocked<DropOffService>;
  let communityRatingService: jest.Mocked<CommunityRatingService>;
  let mockQueue: any;

  beforeEach(async () => {
    const mockStatsQueryService = {
      getStatsByTmdbId: jest.fn(),
    };

    const mockScoreRecalculationService = {
      recalculateScores: jest.fn(),
    };

    const mockStatsBackfillService = {
      backfillTotalWatchers: jest.fn(),
      queueWatchersCountBackfill: jest.fn(),
    };

    const mockDropOffService = {
      getAnalysis: jest.fn(),
    };

    const mockCommunityRatingService = {
      reconcileAll: jest.fn().mockResolvedValue({ updated: 0, reset: 0 }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        { provide: StatsQueryService, useValue: mockStatsQueryService },
        { provide: ScoreRecalculationService, useValue: mockScoreRecalculationService },
        { provide: StatsBackfillService, useValue: mockStatsBackfillService },
        { provide: DropOffService, useValue: mockDropOffService },
        { provide: CommunityRatingService, useValue: mockCommunityRatingService },
        { provide: getQueueToken(STATS_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);
    statsQueryService = module.get(StatsQueryService);
    dropOffService = module.get(DropOffService);
    communityRatingService = module.get(CommunityRatingService);
  });

  describe('syncTrendingStats', () => {
    it('should add sync job to queue', async () => {
      const result = await controller.syncTrendingStats({});

      expect(result).toEqual({
        message: 'Stats sync job added to queue',
        jobId: 'job-123',
      });
      expect(mockQueue.add).toHaveBeenCalledWith(STATS_JOBS.SYNC_TRENDING, { limit: 100 });
    });

    it('should use custom limit when provided', async () => {
      await controller.syncTrendingStats({ limit: 50 });

      expect(mockQueue.add).toHaveBeenCalledWith(STATS_JOBS.SYNC_TRENDING, { limit: 50 });
    });
  });

  describe('getStatsByTmdbId', () => {
    it('should return stats for valid TMDB ID', async () => {
      const mockStats = {
        mediaItemId: 'uuid-123',
        watchersCount: 500,
        trendingRank: 5,
        ratingoScore: 0.75,
      };
      statsQueryService.getStatsByTmdbId.mockResolvedValue(mockStats);

      const result = await controller.getStatsByTmdbId(550);

      expect(result).toEqual(mockStats);
      expect(statsQueryService.getStatsByTmdbId).toHaveBeenCalledWith(550);
    });

    it('should propagate StatsNotFoundException', async () => {
      statsQueryService.getStatsByTmdbId.mockRejectedValue(
        new StatsNotFoundException(999, 'tmdbId'),
      );

      await expect(controller.getStatsByTmdbId(999)).rejects.toThrow(StatsNotFoundException);
    });
  });

  describe('analyzeDropOff', () => {
    it('should add batch analysis job when no tmdbId provided', async () => {
      const result = await controller.analyzeDropOff({});

      expect(result).toEqual({
        message: 'Drop-off analysis job for 50 shows added to queue',
        jobId: 'job-123',
      });
      expect(mockQueue.add).toHaveBeenCalledWith(STATS_JOBS.ANALYZE_DROP_OFF, {
        tmdbId: undefined,
        limit: 50,
      });
    });

    it('should add single show analysis job when tmdbId provided', async () => {
      const result = await controller.analyzeDropOff({ tmdbId: 12345 });

      expect(result).toEqual({
        message: 'Drop-off analysis job for show 12345 added to queue',
        jobId: 'job-123',
      });
      expect(mockQueue.add).toHaveBeenCalledWith(STATS_JOBS.ANALYZE_DROP_OFF, {
        tmdbId: 12345,
        limit: 50,
      });
    });

    it('should use custom limit', async () => {
      await controller.analyzeDropOff({ limit: 100 });

      expect(mockQueue.add).toHaveBeenCalledWith(STATS_JOBS.ANALYZE_DROP_OFF, {
        tmdbId: undefined,
        limit: 100,
      });
    });
  });

  describe('analyzeDropOffById', () => {
    it('should add analysis job for specific show', async () => {
      const result = await controller.analyzeDropOffById(12345);

      expect(result).toEqual({
        message: 'Drop-off analysis job for show 12345 added to queue',
        jobId: 'job-123',
      });
      expect(mockQueue.add).toHaveBeenCalledWith(STATS_JOBS.ANALYZE_DROP_OFF, { tmdbId: 12345 });
    });
  });

  describe('getDropOffAnalysis', () => {
    it('should return analysis when available', async () => {
      const mockAnalysis = {
        dropOffPoint: { season: 3, episode: 1, title: 'Test' },
        dropOffPercent: 64,
        overallRetention: 36,
        seasonEngagement: [],
        insight: 'Test insight',
        insightType: 'drops_late' as const,
        analyzedAt: '2025-12-08T00:00:00.000Z',
        episodesAnalyzed: 36,
      };
      dropOffService.getAnalysis.mockResolvedValue(mockAnalysis);

      const result = await controller.getDropOffAnalysis(12345);

      expect(result).toEqual(mockAnalysis);
      expect(dropOffService.getAnalysis).toHaveBeenCalledWith(12345);
    });

    it('should return message when no analysis available', async () => {
      dropOffService.getAnalysis.mockResolvedValue(null);

      const result = await controller.getDropOffAnalysis(12345);

      expect(result).toEqual({
        message: 'No drop-off analysis available. Run POST /stats/drop-off/analyze/{tmdbId} first.',
        tmdbId: 12345,
      });
    });
  });

  describe('reconcileCommunityRatings', () => {
    it('should call communityRatingService.reconcileAll and return result', async () => {
      communityRatingService.reconcileAll.mockResolvedValue({ updated: 5, reset: 2 });

      const result = await controller.reconcileCommunityRatings();

      expect(result).toEqual({
        message: 'Community ratings reconciliation complete',
        updated: 5,
        reset: 2,
      });
      expect(communityRatingService.reconcileAll).toHaveBeenCalledTimes(1);
    });

    it('should return zero counts when nothing to reconcile', async () => {
      communityRatingService.reconcileAll.mockResolvedValue({ updated: 0, reset: 0 });

      const result = await controller.reconcileCommunityRatings();

      expect(result).toEqual({
        message: 'Community ratings reconciliation complete',
        updated: 0,
        reset: 0,
      });
    });
  });
});
