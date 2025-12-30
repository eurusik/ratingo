import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { TrendingPipeline } from './trending.pipeline';
import { SyncMediaService } from '../services/sync-media.service';
import { BulkJobService } from '../services/bulk-job.service';
import { StatsService } from '../../../stats/application/services/stats.service';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '@/common/enums/media-type.enum';

describe('TrendingPipeline', () => {
  let pipeline: TrendingPipeline;
  let syncService: jest.Mocked<SyncMediaService>;
  let bulkJobService: jest.Mocked<BulkJobService>;
  let statsService: jest.Mocked<StatsService>;

  beforeEach(async () => {
    const mockSyncService = {
      getTrending: jest.fn().mockResolvedValue([]),
      syncMovie: jest.fn().mockResolvedValue(undefined),
      syncShow: jest.fn().mockResolvedValue(undefined),
    };

    const mockBulkJobService = {
      enqueueBulk: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
      enqueueBatch: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
      addDelayed: jest.fn().mockResolvedValue(undefined),
    };

    const mockStatsService = {
      syncTrendingStatsForUpdatedItems: jest.fn().mockResolvedValue({ movies: 0, shows: 0 }),
      syncTrendingStats: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingPipeline,
        { provide: SyncMediaService, useValue: mockSyncService },
        { provide: BulkJobService, useValue: mockBulkJobService },
        { provide: StatsService, useValue: mockStatsService },
      ],
    }).compile();

    pipeline = module.get<TrendingPipeline>(TrendingPipeline);
    syncService = module.get(SyncMediaService);
    bulkJobService = module.get(BulkJobService);
    statsService = module.get(StatsService);
  });

  describe('dispatch', () => {
    it('should enqueue page jobs for movies and shows', async () => {
      await pipeline.dispatch(2, true, false);

      expect(bulkJobService.enqueueBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { type: MediaType.MOVIE, page: 1 },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { type: MediaType.SHOW, page: 2 },
          }),
        ]),
        expect.any(Object),
        expect.any(String),
      );
    });

    it('should enqueue stats job with delay when syncStats=true', async () => {
      await pipeline.dispatch(2, true, false);

      expect(bulkJobService.addDelayed).toHaveBeenCalledWith(
        IngestionJob.SYNC_TRENDING_STATS,
        expect.objectContaining({ since: expect.any(String), limit: 80 }),
        expect.any(String),
        180000,
      );
    });

    it('should not enqueue stats job when syncStats=false', async () => {
      await pipeline.dispatch(2, false, false);

      expect(bulkJobService.addDelayed).not.toHaveBeenCalled();
    });
  });

  describe('processPage', () => {
    it('should fetch trending items and enqueue sync jobs', async () => {
      syncService.getTrending.mockResolvedValue([
        { tmdbId: 100, type: MediaType.MOVIE },
        { tmdbId: 200, type: MediaType.SHOW },
      ]);

      await pipeline.processPage(MediaType.MOVIE, 1);

      expect(syncService.getTrending).toHaveBeenCalledWith(1, MediaType.MOVIE);
      expect(bulkJobService.enqueueBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_MOVIE,
            data: expect.objectContaining({ tmdbId: 100 }),
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_SHOW,
            data: expect.objectContaining({ tmdbId: 200 }),
          }),
        ]),
        expect.any(Object),
        expect.any(String),
      );
    });

    it('should skip if no items found', async () => {
      syncService.getTrending.mockResolvedValue([]);

      await pipeline.processPage(MediaType.MOVIE, 1);

      expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
    });
  });

  describe('processStats', () => {
    it('should sync trending stats', async () => {
      const since = new Date().toISOString();

      await pipeline.processStats(since, 200);

      expect(statsService.syncTrendingStatsForUpdatedItems).toHaveBeenCalledWith({
        since: expect.any(Date),
        limit: 200,
      });
    });
  });

  describe('processFull', () => {
    it('should sync trending items and stats', async () => {
      syncService.getTrending.mockResolvedValue([
        { tmdbId: 100, type: MediaType.MOVIE },
        { tmdbId: 200, type: MediaType.SHOW },
      ]);

      await pipeline.processFull(1, true);

      expect(syncService.syncMovie).toHaveBeenCalledWith(100);
      expect(syncService.syncShow).toHaveBeenCalledWith(200);
      expect(statsService.syncTrendingStats).toHaveBeenCalled();
    });
  });
});
