import { Test, TestingModule } from '@nestjs/testing';
import { SyncWorker } from './sync.worker';
import { SyncMediaService } from '../services/sync-media.service';
import { IngestionJob } from '../../ingestion.constants';
import { Job } from 'bullmq';
import { MediaType } from '@/common/enums/media-type.enum';
import { SnapshotsPipeline } from '../pipelines/snapshots.pipeline';
import { TrendingPipeline } from '../pipelines/trending.pipeline';
import { TrackedShowsPipeline } from '../pipelines/tracked-shows.pipeline';
import { NowPlayingPipeline } from '../pipelines/now-playing.pipeline';
import { NewReleasesPipeline } from '../pipelines/new-releases.pipeline';
import { destroyTraktRateLimiter } from '../../infrastructure/adapters/trakt/base-trakt-http';

afterAll(() => {
  destroyTraktRateLimiter();
});

describe('SyncWorker', () => {
  let worker: SyncWorker;
  let syncService: any;
  let snapshotsPipeline: any;
  let trendingPipeline: any;
  let trackedShowsPipeline: any;
  let nowPlayingPipeline: any;
  let newReleasesPipeline: any;

  beforeEach(async () => {
    syncService = {
      syncMovie: jest.fn().mockResolvedValue(undefined),
      syncShow: jest.fn().mockResolvedValue(undefined),
    };

    snapshotsPipeline = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      processItem: jest.fn().mockResolvedValue(undefined),
    };

    trendingPipeline = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      processPage: jest.fn().mockResolvedValue(undefined),
      processStats: jest.fn().mockResolvedValue(undefined),
      processFull: jest.fn().mockResolvedValue(undefined),
    };

    trackedShowsPipeline = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      processBatch: jest.fn().mockResolvedValue(undefined),
    };

    nowPlayingPipeline = {
      sync: jest.fn().mockResolvedValue(undefined),
      updateFlags: jest.fn().mockResolvedValue(undefined),
    };

    newReleasesPipeline = {
      sync: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncWorker,
        { provide: SyncMediaService, useValue: syncService },
        { provide: SnapshotsPipeline, useValue: snapshotsPipeline },
        { provide: TrendingPipeline, useValue: trendingPipeline },
        { provide: TrackedShowsPipeline, useValue: trackedShowsPipeline },
        { provide: NowPlayingPipeline, useValue: nowPlayingPipeline },
        { provide: NewReleasesPipeline, useValue: newReleasesPipeline },
      ],
    }).compile();

    worker = module.get<SyncWorker>(SyncWorker);
  });

  describe('process - direct sync jobs', () => {
    it('should process SYNC_MOVIE job', async () => {
      const job = { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 550 }, id: 'test-job-1' } as Job;
      await worker.process(job);
      expect(syncService.syncMovie).toHaveBeenCalledWith(550, undefined, 'test-job-1');
    });

    it('should process SYNC_SHOW job with trending data', async () => {
      const job = {
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId: 100, trending: { score: 9999, rank: 2 } },
        id: 'test-job-2',
      } as Job;
      await worker.process(job);
      expect(syncService.syncShow).toHaveBeenCalledWith(
        100,
        { score: 9999, rank: 2 },
        'test-job-2',
      );
    });
  });

  describe('process - snapshots pipeline', () => {
    it('should delegate SYNC_SNAPSHOTS_DISPATCHER to snapshots pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
        data: { region: 'UA' },
        id: '3',
      } as Job;
      await worker.process(job);
      expect(snapshotsPipeline.dispatch).toHaveBeenCalledWith('UA');
    });

    it('should delegate SYNC_SNAPSHOT_ITEM to snapshots pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_SNAPSHOT_ITEM,
        data: { mediaItemId: 'media-1', dayId: '20251221', region: 'UA' },
        id: '4',
      } as Job;
      await worker.process(job);
      expect(snapshotsPipeline.processItem).toHaveBeenCalledWith('media-1', '20251221', 'UA');
    });
  });

  describe('process - trending pipeline', () => {
    it('should delegate SYNC_TRENDING_DISPATCHER to trending pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_TRENDING_DISPATCHER,
        data: { pages: 5, syncStats: true, force: false },
        id: '5',
      } as Job;
      await worker.process(job);
      expect(trendingPipeline.dispatch).toHaveBeenCalledWith(5, true, false);
    });

    it('should delegate SYNC_TRENDING_PAGE to trending pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_TRENDING_PAGE,
        data: { type: MediaType.MOVIE, page: 1 },
        id: 'trending-page-6',
      } as Job;
      await worker.process(job);
      expect(trendingPipeline.processPage).toHaveBeenCalledWith(MediaType.MOVIE, 1, 'g-page-6');
    });

    it('should delegate SYNC_TRENDING_STATS to trending pipeline', async () => {
      const since = new Date().toISOString();
      const job = {
        name: IngestionJob.SYNC_TRENDING_STATS,
        data: { since, limit: 200 },
        id: '7',
      } as Job;
      await worker.process(job);
      expect(trendingPipeline.processStats).toHaveBeenCalledWith(since, 200);
    });

    it('should delegate SYNC_TRENDING_FULL to trending pipeline (deprecated)', async () => {
      const job = {
        name: IngestionJob.SYNC_TRENDING_FULL,
        data: { page: 1, syncStats: true, type: MediaType.MOVIE },
        id: '8',
      } as Job;
      await worker.process(job);
      expect(trendingPipeline.processFull).toHaveBeenCalledWith(1, true, MediaType.MOVIE);
    });
  });

  describe('process - tracked shows pipeline', () => {
    it('should delegate SYNC_TRACKED_SHOWS to tracked shows pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_TRACKED_SHOWS,
        data: { window: '2025122119' },
        id: '9',
      } as Job;
      await worker.process(job);
      expect(trackedShowsPipeline.dispatch).toHaveBeenCalledWith('2025122119');
    });

    it('should delegate SYNC_TRACKED_SHOW_BATCH to tracked shows pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_TRACKED_SHOW_BATCH,
        data: { tmdbIds: [100, 200, 300] },
        id: '10',
      } as Job;
      await worker.process(job);
      expect(trackedShowsPipeline.processBatch).toHaveBeenCalledWith([100, 200, 300]);
    });
  });

  describe('process - now playing pipeline', () => {
    it('should delegate SYNC_NOW_PLAYING to now playing pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_NOW_PLAYING,
        data: { region: 'UA' },
        id: '11',
      } as Job;
      await worker.process(job);
      expect(nowPlayingPipeline.sync).toHaveBeenCalledWith('UA');
    });

    it('should delegate UPDATE_NOW_PLAYING_FLAGS to now playing pipeline', async () => {
      const job = {
        name: IngestionJob.UPDATE_NOW_PLAYING_FLAGS,
        data: { region: 'UA' },
        id: '12',
      } as Job;
      await worker.process(job);
      expect(nowPlayingPipeline.updateFlags).toHaveBeenCalledWith('UA');
    });
  });

  describe('process - new releases pipeline', () => {
    it('should delegate SYNC_NEW_RELEASES to new releases pipeline', async () => {
      const job = {
        name: IngestionJob.SYNC_NEW_RELEASES,
        data: { region: 'UA', daysBack: 30 },
        id: '13',
      } as Job;
      await worker.process(job);
      expect(newReleasesPipeline.sync).toHaveBeenCalledWith('UA', 30);
    });
  });

  describe('error handling', () => {
    it('should log and rethrow errors', async () => {
      const error = new Error('Pipeline failed');
      syncService.syncMovie.mockRejectedValue(error);
      const job = { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 550 }, id: 'err-1' } as Job;

      await expect(worker.process(job)).rejects.toThrow(error);
    });
  });

  describe('unknown job types', () => {
    it('should log warning for unknown job type', async () => {
      const job = { name: 'UNKNOWN_JOB' as any, data: {}, id: 'unknown-1' } as Job;
      const loggerSpy = jest.spyOn((worker as any).logger, 'warn');

      await worker.process(job);

      expect(loggerSpy).toHaveBeenCalledWith('[job:unknown-1] Unknown job type: UNKNOWN_JOB');
    });
  });
});
