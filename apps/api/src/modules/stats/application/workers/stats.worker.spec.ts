import { Test, TestingModule } from '@nestjs/testing';
import { StatsWorker } from './stats.worker';
import { CommunityRatingService } from '../services/community-rating.service';
import { DropOffService, StatsBackfillService, TrendingSyncService } from '../services';
import { STATS_JOBS } from '../../stats.constants';
import { Job } from 'bullmq';

describe('StatsWorker', () => {
  let worker: StatsWorker;
  let trendingSyncService: any;
  let statsBackfillService: any;
  let dropOffService: any;
  let communityRatingService: any;

  beforeEach(async () => {
    trendingSyncService = {
      syncTrendingStats: jest.fn(),
    };

    statsBackfillService = {
      processWatchersChunk: jest.fn(),
    };

    dropOffService = {
      analyzeShow: jest.fn(),
      analyzeAllShows: jest.fn(),
    };

    communityRatingService = {
      recalculateForMediaItem: jest.fn(),
      reconcileAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsWorker,
        { provide: TrendingSyncService, useValue: trendingSyncService },
        { provide: StatsBackfillService, useValue: statsBackfillService },
        { provide: DropOffService, useValue: dropOffService },
        { provide: CommunityRatingService, useValue: communityRatingService },
      ],
    }).compile();

    worker = module.get<StatsWorker>(StatsWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    it('should process SYNC_TRENDING job', async () => {
      const job = { name: STATS_JOBS.SYNC_TRENDING, data: { limit: 50 }, id: '1' } as Job;
      await worker.process(job);
      expect(trendingSyncService.syncTrendingStats).toHaveBeenCalledWith(50);
    });

    it('should use default limit for SYNC_TRENDING job', async () => {
      const job = { name: STATS_JOBS.SYNC_TRENDING, data: {}, id: '2' } as Job;
      await worker.process(job);
      expect(trendingSyncService.syncTrendingStats).toHaveBeenCalledWith(100);
    });

    it('should process ANALYZE_DROP_OFF job for single show', async () => {
      const job = { name: STATS_JOBS.ANALYZE_DROP_OFF, data: { tmdbId: 123 }, id: '3' } as Job;
      await worker.process(job);
      expect(dropOffService.analyzeShow).toHaveBeenCalledWith(123);
      expect(dropOffService.analyzeAllShows).not.toHaveBeenCalled();
    });

    it('should process ANALYZE_DROP_OFF job for all shows', async () => {
      const job = { name: STATS_JOBS.ANALYZE_DROP_OFF, data: { limit: 100 }, id: '4' } as Job;
      await worker.process(job);
      expect(dropOffService.analyzeAllShows).toHaveBeenCalledWith(100);
      expect(dropOffService.analyzeShow).not.toHaveBeenCalled();
    });

    it('should use default limit for ANALYZE_DROP_OFF job (all shows)', async () => {
      const job = { name: STATS_JOBS.ANALYZE_DROP_OFF, data: {}, id: '5' } as Job;
      await worker.process(job);
      expect(dropOffService.analyzeAllShows).toHaveBeenCalledWith(50);
    });

    it('should process RECONCILE_COMMUNITY_RATINGS job', async () => {
      communityRatingService.reconcileAll.mockResolvedValue({ updated: 10, reset: 0 });
      const job = { name: STATS_JOBS.RECONCILE_COMMUNITY_RATINGS, data: {}, id: '8' } as Job;
      await worker.process(job);
      expect(communityRatingService.reconcileAll).toHaveBeenCalled();
    });

    it('should log warning for unknown job type', async () => {
      const job = { name: 'UNKNOWN_JOB', data: {}, id: '6' } as Job;
      await worker.process(job);
      expect(trendingSyncService.syncTrendingStats).not.toHaveBeenCalled();
      expect(dropOffService.analyzeShow).not.toHaveBeenCalled();
    });

    it('should rethrow errors', async () => {
      const error = new Error('Processing failed');
      trendingSyncService.syncTrendingStats.mockRejectedValue(error);
      const job = { name: STATS_JOBS.SYNC_TRENDING, data: {}, id: '7' } as Job;

      await expect(worker.process(job)).rejects.toThrow(error);
    });
  });
});
