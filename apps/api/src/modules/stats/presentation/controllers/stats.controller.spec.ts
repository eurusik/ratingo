import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from '../../application/services/stats.service';
import { DropOffService } from '../../application/services/drop-off.service';
import { getQueueToken } from '@nestjs/bullmq';
import { STATS_QUEUE, STATS_JOBS } from '../../stats.constants';
import { StatsNotFoundException } from '@/common/exceptions';

describe('StatsController', () => {
  let controller: StatsController;
  let statsService: jest.Mocked<StatsService>;
  let dropOffService: jest.Mocked<DropOffService>;
  let mockQueue: any;

  beforeEach(async () => {
    const mockStatsService = {
      getStatsByTmdbId: jest.fn(),
    };

    const mockDropOffService = {
      getAnalysis: jest.fn(),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        { provide: StatsService, useValue: mockStatsService },
        { provide: DropOffService, useValue: mockDropOffService },
        { provide: getQueueToken(STATS_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);
    statsService = module.get(StatsService);
    dropOffService = module.get(DropOffService);
  });

  describe('syncTrendingStats', () => {
    it('should add sync job to queue', async () => {
      const result = await controller.syncTrendingStats();

      expect(result).toEqual({
        message: 'Stats sync job added to queue',
        jobId: 'job-123',
      });
      expect(mockQueue.add).toHaveBeenCalledWith(STATS_JOBS.SYNC_TRENDING, { limit: 20 });
    });

    it('should use custom limit when provided', async () => {
      await controller.syncTrendingStats(50);

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
      statsService.getStatsByTmdbId.mockResolvedValue(mockStats);

      const result = await controller.getStatsByTmdbId(550);

      expect(result).toEqual(mockStats);
      expect(statsService.getStatsByTmdbId).toHaveBeenCalledWith(550);
    });

    it('should propagate StatsNotFoundException', async () => {
      statsService.getStatsByTmdbId.mockRejectedValue(new StatsNotFoundException(999, 'tmdbId'));

      await expect(controller.getStatsByTmdbId(999)).rejects.toThrow(StatsNotFoundException);
    });
  });

  describe('analyzeDropOff', () => {
    it('should add batch analysis job when no tmdbId provided', async () => {
      const result = await controller.analyzeDropOff();

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
      const result = await controller.analyzeDropOff(12345);

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
      await controller.analyzeDropOff(undefined, 100);

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
});
