import { Test, TestingModule } from '@nestjs/testing';
import { StatsWorker } from './stats.worker';
import { StatsService } from '../services/stats.service';
import { DropOffService } from '../services/drop-off.service';
import { STATS_JOBS } from '../../stats.constants';
import { Job } from 'bullmq';

describe('StatsWorker', () => {
  let worker: StatsWorker;
  let statsService: any;
  let dropOffService: any;

  beforeEach(async () => {
    statsService = {
      syncTrendingStats: jest.fn(),
    };

    dropOffService = {
      analyzeShow: jest.fn(),
      analyzeAllShows: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsWorker,
        { provide: StatsService, useValue: statsService },
        { provide: DropOffService, useValue: dropOffService },
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
      expect(statsService.syncTrendingStats).toHaveBeenCalledWith(50);
    });

    it('should use default limit for SYNC_TRENDING job', async () => {
      const job = { name: STATS_JOBS.SYNC_TRENDING, data: {}, id: '2' } as Job;
      await worker.process(job);
      expect(statsService.syncTrendingStats).toHaveBeenCalledWith(20);
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

    it('should log warning for unknown job type', async () => {
      const job = { name: 'UNKNOWN_JOB', data: {}, id: '6' } as Job;
      await worker.process(job);
      expect(statsService.syncTrendingStats).not.toHaveBeenCalled();
      expect(dropOffService.analyzeShow).not.toHaveBeenCalled();
    });

    it('should rethrow errors', async () => {
      const error = new Error('Processing failed');
      statsService.syncTrendingStats.mockRejectedValue(error);
      const job = { name: STATS_JOBS.SYNC_TRENDING, data: {}, id: '7' } as Job;

      await expect(worker.process(job)).rejects.toThrow(error);
    });
  });
});
