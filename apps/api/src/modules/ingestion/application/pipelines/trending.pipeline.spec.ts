import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { TrendingPipeline } from './trending.pipeline';
import { SyncMediaService } from '../services/sync-media.service';
import { StatsService } from '../../../stats/application/services/stats.service';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '@/common/enums/media-type.enum';

describe('TrendingPipeline', () => {
  let pipeline: TrendingPipeline;
  let syncService: any;
  let statsService: any;
  let ingestionQueue: any;

  beforeEach(async () => {
    syncService = {
      getTrending: jest.fn().mockResolvedValue([]),
      syncMovie: jest.fn().mockResolvedValue(undefined),
      syncShow: jest.fn().mockResolvedValue(undefined),
    };

    statsService = {
      syncTrendingStatsForUpdatedItems: jest.fn().mockResolvedValue({ movies: 0, shows: 0 }),
      syncTrendingStats: jest.fn().mockResolvedValue(undefined),
    };

    ingestionQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      addBulk: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingPipeline,
        { provide: SyncMediaService, useValue: syncService },
        { provide: StatsService, useValue: statsService },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
      ],
    }).compile();

    pipeline = module.get<TrendingPipeline>(TrendingPipeline);
  });

  describe('dispatch', () => {
    it('should enqueue page jobs for movies and shows', async () => {
      await pipeline.dispatch(2, true, false);

      expect(ingestionQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { type: MediaType.MOVIE, page: 1 },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { type: MediaType.SHOW, page: 1 },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { type: MediaType.MOVIE, page: 2 },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { type: MediaType.SHOW, page: 2 },
          }),
        ]),
      );
    });

    it('should enqueue stats job with delay when syncStats=true', async () => {
      await pipeline.dispatch(2, true, false);

      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_TRENDING_STATS,
        expect.objectContaining({ since: expect.any(String), limit: 80 }),
        expect.objectContaining({ delay: 180000 }),
      );
    });

    it('should not enqueue stats job when syncStats=false', async () => {
      await pipeline.dispatch(2, false, false);

      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });

    it('should deduplicate page jobs', async () => {
      ingestionQueue.getJob.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValue(null);

      await pipeline.dispatch(1, false, false);

      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          data: { type: MediaType.SHOW, page: 1 },
        }),
      ]);
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
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_MOVIE,
            data: expect.objectContaining({ tmdbId: 100, trending: expect.any(Object) }),
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_SHOW,
            data: expect.objectContaining({ tmdbId: 200, trending: expect.any(Object) }),
          }),
        ]),
      );
    });

    it('should skip if no items found', async () => {
      syncService.getTrending.mockResolvedValue([]);

      await pipeline.processPage(MediaType.MOVIE, 1);

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
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
