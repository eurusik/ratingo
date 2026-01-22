import { Test, TestingModule } from '@nestjs/testing';
import { TrendingPipeline } from './trending.pipeline';
import { SyncMediaService } from '../services/sync-media.service';
import { BulkJobService } from '../services/bulk-job.service';
import { TrendingSyncService } from '../../../stats/public';
import { CATALOG_POLICY_EVALUATOR } from '../../../catalog-policy/public';
import { IngestionJob } from '../../ingestion.constants';
import { MediaType } from '@/common/enums/media-type.enum';

describe('TrendingPipeline', () => {
  let pipeline: TrendingPipeline;
  let syncService: jest.Mocked<SyncMediaService>;
  let bulkJobService: jest.Mocked<BulkJobService>;
  let trendingSyncService: jest.Mocked<TrendingSyncService>;
  let catalogEvaluator: jest.Mocked<{ getEligibilityStats: jest.Mock }>;

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

    const mockTrendingSyncService = {
      syncTrendingStatsForUpdatedItems: jest.fn().mockResolvedValue({ movies: 0, shows: 0 }),
      syncTrendingStats: jest.fn().mockResolvedValue(undefined),
    };

    const mockCatalogEvaluator = {
      getEligibilityStats: jest.fn().mockResolvedValue({
        eligible: 80,
        ineligible: 120,
        review: 0,
        total: 200,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingPipeline,
        { provide: SyncMediaService, useValue: mockSyncService },
        { provide: BulkJobService, useValue: mockBulkJobService },
        { provide: TrendingSyncService, useValue: mockTrendingSyncService },
        { provide: CATALOG_POLICY_EVALUATOR, useValue: mockCatalogEvaluator },
      ],
    }).compile();

    pipeline = module.get<TrendingPipeline>(TrendingPipeline);
    syncService = module.get(SyncMediaService);
    bulkJobService = module.get(BulkJobService);
    trendingSyncService = module.get(TrendingSyncService);
    catalogEvaluator = module.get(CATALOG_POLICY_EVALUATOR);
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

      // Uses TRENDING_DEFAULT_STATS_LIMIT (50) instead of calculated limit
      // to avoid Trakt rate limiting
      expect(bulkJobService.addDelayed).toHaveBeenCalledWith(
        IngestionJob.SYNC_TRENDING_STATS,
        expect.objectContaining({ since: expect.any(String), limit: 50 }),
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

      expect(trendingSyncService.syncTrendingStatsForUpdatedItems).toHaveBeenCalledWith({
        since: expect.any(Date),
        limit: 200,
      });
    });

    it('should log eligibility stats after sync', async () => {
      await pipeline.processStats();

      expect(catalogEvaluator.getEligibilityStats).toHaveBeenCalledWith('trending');
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
      expect(trendingSyncService.syncTrendingStats).toHaveBeenCalled();
    });
  });
});
