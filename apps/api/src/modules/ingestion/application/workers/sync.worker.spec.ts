import { Test, TestingModule } from '@nestjs/testing';
import { SyncWorker } from './sync.worker';
import { SyncMediaService } from '../services/sync-media.service';
import { SnapshotsService } from '../services/snapshots.service';
import { TrackedSyncService } from '../services/tracked-sync.service';
import { TmdbAdapter } from '@/modules/tmdb/tmdb.adapter';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { Job } from 'bullmq';
import { StatsService } from '../../../stats/application/services/stats.service';
import { SubscriptionTriggerService } from '../../../user-actions/application/subscription-trigger.service';
import { MOVIE_REPOSITORY } from '../../../catalog/domain/repositories/movie.repository.interface';
import {
  MEDIA_REPOSITORY,
  IMediaRepository,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { USER_SUBSCRIPTION_REPOSITORY } from '../../../user-actions/domain/repositories/user-subscription.repository.interface';
import { MediaType } from '@/common/enums/media-type.enum';
import { destroyTraktRateLimiter } from '../../infrastructure/adapters/trakt/base-trakt-http';

// Cleanup rate limiter interval to prevent Jest from hanging
afterAll(() => {
  destroyTraktRateLimiter();
});

describe('SyncWorker', () => {
  let worker: SyncWorker;
  let syncService: any;
  let snapshotsService: any;
  let trackedSyncService: any;
  let tmdbAdapter: any;
  let ingestionQueue: any;
  let movieRepository: any;
  let mediaRepository: any;
  let statsService: any;
  let subscriptionTriggerService: any;
  let userSubscriptionRepository: any;

  beforeEach(async () => {
    syncService = {
      syncMovie: jest.fn(),
      syncShow: jest.fn(),
      getTrending: jest.fn().mockResolvedValue([]),
    };

    snapshotsService = {
      syncSnapshotItem: jest.fn(),
    };

    trackedSyncService = {
      syncShowWithDiff: jest.fn(),
    };

    tmdbAdapter = {
      getNowPlayingIds: jest.fn().mockResolvedValue([]),
      getNewReleaseIds: jest.fn().mockResolvedValue([]),
    };

    ingestionQueue = {
      add: jest.fn(),
      addBulk: jest.fn(),
      getJob: jest.fn(),
    };

    movieRepository = {
      setNowPlaying: jest.fn(),
    };

    mediaRepository = {
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
      findIdsForSnapshots: jest.fn().mockResolvedValue([]),
    };

    statsService = {
      syncTrendingStats: jest.fn(),
      syncTrendingStatsForUpdatedItems: jest.fn().mockResolvedValue({ movies: 0, shows: 0 }),
    };

    subscriptionTriggerService = {
      handleShowDiff: jest.fn(),
    };

    userSubscriptionRepository = {
      findTrackedShowTmdbIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncWorker,
        { provide: SyncMediaService, useValue: syncService },
        { provide: SnapshotsService, useValue: snapshotsService },
        { provide: TrackedSyncService, useValue: trackedSyncService },
        { provide: SubscriptionTriggerService, useValue: subscriptionTriggerService },
        { provide: TmdbAdapter, useValue: tmdbAdapter },
        { provide: StatsService, useValue: statsService },
        { provide: MOVIE_REPOSITORY, useValue: movieRepository },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: userSubscriptionRepository },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
      ],
    }).compile();

    worker = module.get<SyncWorker>(SyncWorker);
  });

  describe('process', () => {
    it('should process SYNC_MOVIE job', async () => {
      const job = { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 550 }, id: '1' } as Job;
      await worker.process(job);
      expect(syncService.syncMovie).toHaveBeenCalledWith(550, undefined);
    });

    it('should process SYNC_SHOW job with trending data', async () => {
      const job = {
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId: 100, trending: { score: 9999, rank: 2 } },
        id: '2',
      } as Job;
      await worker.process(job);
      expect(syncService.syncShow).toHaveBeenCalledWith(100, { score: 9999, rank: 2 });
    });

    it('should process UPDATE_NOW_PLAYING_FLAGS and queue missing movies', async () => {
      // Mock TMDB returns [1, 2, 3]
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([1, 2, 3]);

      // Mock DB has only [1, 2] (3 is missing)
      mediaRepository.findManyByTmdbIds.mockResolvedValue([
        { tmdbId: 1, id: 'id-1' },
        { tmdbId: 2, id: 'id-2' },
      ]);

      const job = {
        name: IngestionJob.UPDATE_NOW_PLAYING_FLAGS,
        data: { region: 'UA' },
        id: '3',
      } as Job;

      await worker.process(job);

      expect(tmdbAdapter.getNowPlayingIds).toHaveBeenCalledWith('UA');
      expect(mediaRepository.findManyByTmdbIds).toHaveBeenCalledWith([1, 2, 3]);

      // Should queue sync for missing ID 3 with dedupe jobId
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId: 3 },
          opts: expect.objectContaining({ jobId: expect.stringMatching(/^movie_3_\d{8}$/) }),
        }),
      ]);

      // Should call setNowPlaying with all IDs
      expect(movieRepository.setNowPlaying).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('should process SYNC_SNAPSHOTS job as dispatcher', async () => {
      const job = { name: IngestionJob.SYNC_SNAPSHOTS, data: {}, id: '5' } as Job;
      await worker.process(job);
      expect(mediaRepository.findIdsForSnapshots).toHaveBeenCalled();
    });
  });

  describe('processNowPlaying (private)', () => {
    it('should sync now playing movies with jobId dedupe', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([10, 20]);
      ingestionQueue.getJob.mockResolvedValue(null); // No existing jobs
      const job = { name: IngestionJob.SYNC_NOW_PLAYING, data: { region: 'US' }, id: '4' } as Job;

      await worker.process(job);

      expect(tmdbAdapter.getNowPlayingIds).toHaveBeenCalledWith('US');

      // Should check for existing jobs
      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);

      // Should add jobs with jobId for dedupe via addBulk
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId: 10 },
          opts: expect.objectContaining({ jobId: expect.stringMatching(/^movie_10_\d{8}$/) }),
        }),
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId: 20 },
          opts: expect.objectContaining({ jobId: expect.stringMatching(/^movie_20_\d{8}$/) }),
        }),
      ]);
    });

    it('should skip already queued movies (dedupe)', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([10, 20]);
      // Mock: job for tmdbId=10 already exists
      ingestionQueue.getJob.mockImplementation((jobId: string) => {
        if (jobId.includes('movie_10_')) {
          return Promise.resolve({ id: 'existing-job' } as Job);
        }
        return Promise.resolve(null);
      });
      const job = { name: IngestionJob.SYNC_NOW_PLAYING, data: { region: 'US' }, id: '4' } as Job;

      await worker.process(job);

      // Should only add job for tmdbId=20 (10 is deduped)
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId: 20 },
          opts: expect.objectContaining({ jobId: expect.stringMatching(/^movie_20_\d{8}$/) }),
        }),
      ]);
    });
  });

  describe('processNewReleases', () => {
    it('should queue new releases sync jobs with dedupe', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([30, 40]);
      // Mock no existing jobs
      ingestionQueue.getJob.mockResolvedValue(null);

      const job = {
        name: IngestionJob.SYNC_NEW_RELEASES,
        data: { region: 'GB', daysBack: 60 },
        id: '6',
      } as Job;

      await worker.process(job);

      expect(tmdbAdapter.getNewReleaseIds).toHaveBeenCalledWith(60, 'GB');

      // Verify dedupe checks
      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.getJob).toHaveBeenCalledWith(expect.stringMatching(/^movie_30_\d{8}$/));
      expect(ingestionQueue.getJob).toHaveBeenCalledWith(expect.stringMatching(/^movie_40_\d{8}$/));

      // Verify bulk add with jobIds
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId: 30 },
          opts: expect.objectContaining({ jobId: expect.stringMatching(/^movie_30_\d{8}$/) }),
        }),
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId: 40 },
          opts: expect.objectContaining({ jobId: expect.stringMatching(/^movie_40_\d{8}$/) }),
        }),
      ]);
    });

    it('should skip already queued releases (dedupe)', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([30, 40]);

      // Mock job 30 exists, 40 does not
      ingestionQueue.getJob.mockImplementation((jobId: string) => {
        if (jobId.includes('movie_30_')) return Promise.resolve({ id: 'existing' } as Job);
        return Promise.resolve(null);
      });

      const job = {
        name: IngestionJob.SYNC_NEW_RELEASES,
        data: { region: 'GB', daysBack: 60 },
        id: '6',
      } as Job;

      await worker.process(job);

      // Should add only 40
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId: 40 },
          opts: expect.objectContaining({ jobId: expect.stringMatching(/^movie_40_\d{8}$/) }),
        }),
      ]);
    });

    it('should not call addBulk if all releases are already queued (full dedupe)', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([30, 40]);

      // Mock both jobs exist
      ingestionQueue.getJob.mockResolvedValue({ id: 'existing' } as Job);

      const job = {
        name: IngestionJob.SYNC_NEW_RELEASES,
        data: { region: 'GB', daysBack: 60 },
        id: '6-dedupe',
      } as Job;

      await worker.process(job);

      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
    });

    it('should do nothing if no new releases found', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([]);
      const job = { name: IngestionJob.SYNC_NEW_RELEASES, data: { region: 'US' }, id: '7' } as Job;

      await worker.process(job);

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
    });
  });

  describe('processSnapshotsDispatcher', () => {
    it('should queue snapshot item jobs with cursor pagination', async () => {
      // Mock repository returning IDs in 2 pages
      mediaRepository.findIdsForSnapshots
        .mockResolvedValueOnce(['id-1', 'id-2']) // Page 1
        .mockResolvedValueOnce(['id-3']) // Page 2
        .mockResolvedValueOnce([]); // Done

      ingestionQueue.getJob.mockResolvedValue(null); // No existing jobs

      const job = {
        name: IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
        data: { region: 'global' },
        id: 'snap-disp-1',
      } as Job;

      await worker.process(job);

      // Should call findIdsForSnapshots 3 times (page 1, page 2, empty)
      expect(mediaRepository.findIdsForSnapshots).toHaveBeenCalledTimes(3);
      expect(mediaRepository.findIdsForSnapshots).toHaveBeenNthCalledWith(1, {
        limit: 500,
        cursor: undefined,
      });
      expect(mediaRepository.findIdsForSnapshots).toHaveBeenNthCalledWith(2, {
        limit: 500,
        cursor: 'id-2',
      });
      expect(mediaRepository.findIdsForSnapshots).toHaveBeenNthCalledWith(3, {
        limit: 500,
        cursor: 'id-3',
      });

      // Should add jobs in bulk (once per non-empty page)
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(2);

      // Check first batch
      expect(ingestionQueue.addBulk).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          name: IngestionJob.SYNC_SNAPSHOT_ITEM,
          data: expect.objectContaining({ mediaItemId: 'id-1', region: 'global' }),
          opts: expect.objectContaining({
            jobId: expect.stringMatching(/^snapshot_id-1_\d{8}_global$/),
          }),
        }),
        expect.objectContaining({
          name: IngestionJob.SYNC_SNAPSHOT_ITEM,
          data: expect.objectContaining({ mediaItemId: 'id-2', region: 'global' }),
          opts: expect.objectContaining({
            jobId: expect.stringMatching(/^snapshot_id-2_\d{8}_global$/),
          }),
        }),
      ]);

      // Check second batch
      expect(ingestionQueue.addBulk).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          name: IngestionJob.SYNC_SNAPSHOT_ITEM,
          data: expect.objectContaining({ mediaItemId: 'id-3', region: 'global' }),
        }),
      ]);
    });

    it('should skip already queued snapshot items (dedupe)', async () => {
      mediaRepository.findIdsForSnapshots
        .mockResolvedValueOnce(['id-1', 'id-2'])
        .mockResolvedValueOnce([]);

      // Mock: id-1 exists, id-2 does not
      ingestionQueue.getJob.mockImplementation((jobId: string) => {
        if (jobId.includes('snapshot_id-1_')) return Promise.resolve({ id: 'existing' } as Job);
        return Promise.resolve(null);
      });

      const job = {
        name: IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
        data: { region: 'global' },
        id: 'snap-disp-2',
      } as Job;

      await worker.process(job);

      // Should only add id-2
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_SNAPSHOT_ITEM,
          data: expect.objectContaining({ mediaItemId: 'id-2' }),
        }),
      ]);
    });
  });

  describe('processSnapshotItem', () => {
    it('should call service to sync snapshot', async () => {
      const job = {
        name: IngestionJob.SYNC_SNAPSHOT_ITEM,
        data: { mediaItemId: 'uuid-123', dayId: '20231225', region: 'global' },
        id: 'snap-item-1',
      } as Job;

      await worker.process(job);

      expect(snapshotsService.syncSnapshotItem).toHaveBeenCalledWith(
        'uuid-123',
        new Date(Date.UTC(2023, 11, 25)), // 2023-12-25
        'global',
      );
    });
  });

  describe('processTrendingFull', () => {
    it('should process full trending sync', async () => {
      const mockItems = [
        { tmdbId: 100, type: 'movie' },
        { tmdbId: 200, type: 'show' }, // Use string literal to match MediaType enum usually
      ];
      syncService.getTrending.mockResolvedValue(mockItems);

      const job = {
        name: IngestionJob.SYNC_TRENDING_FULL,
        data: { page: 1, syncStats: true },
        id: '8',
      } as Job;

      await worker.process(job);

      expect(syncService.getTrending).toHaveBeenCalledWith(1, undefined);
      // Now uses trending object with score and rank
      expect(syncService.syncMovie).toHaveBeenCalledWith(100, { score: 10000, rank: 1 });
      expect(syncService.syncShow).toHaveBeenCalledWith(200, { score: 9999, rank: 2 });
      expect(statsService.syncTrendingStats).toHaveBeenCalled();
    });

    it('should skip stats sync if syncStats is false', async () => {
      syncService.getTrending.mockResolvedValue([]);
      const job = {
        name: IngestionJob.SYNC_TRENDING_FULL,
        data: { page: 1, syncStats: false },
        id: '9',
      } as Job;

      await worker.process(job);

      expect(statsService.syncTrendingStats).not.toHaveBeenCalled();
    });

    it('should continue processing items even if one fails', async () => {
      const mockItems = [
        { tmdbId: 100, type: 'movie' }, // Fails
        { tmdbId: 200, type: 'show' }, // Succeeds
      ];
      syncService.getTrending.mockResolvedValue(mockItems);
      syncService.syncMovie.mockRejectedValue(new Error('Sync failed'));

      const job = {
        name: IngestionJob.SYNC_TRENDING_FULL,
        data: { page: 1 },
        id: '10',
      } as Job;

      await worker.process(job);

      expect(syncService.syncMovie).toHaveBeenCalled();
      expect(syncService.syncShow).toHaveBeenCalled(); // Should still be called
    });
  });

  describe('error handling', () => {
    it('should log and rethrow errors', async () => {
      const error = new Error('Processing failed');
      syncService.syncMovie.mockRejectedValue(error);
      const job = { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 550 }, id: 'err-1' } as Job;

      await expect(worker.process(job)).rejects.toThrow(error);
    });
  });

  describe('processTrendingDispatcher', () => {
    it('should queue page jobs for movies and shows', async () => {
      ingestionQueue.getJob.mockResolvedValue(null);

      const job = {
        name: IngestionJob.SYNC_TRENDING_DISPATCHER,
        data: { pages: 2, syncStats: true },
        id: 'disp-1',
      } as Job;

      await worker.process(job);

      // Should queue 2 pages × 2 types = 4 page jobs via addBulk
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { page: 1, type: MediaType.MOVIE },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { page: 1, type: MediaType.SHOW },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { page: 2, type: MediaType.MOVIE },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_TRENDING_PAGE,
            data: { page: 2, type: MediaType.SHOW },
          }),
        ]),
      );

      // Pre-dedupe checks should happen for each page job
      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(4);
      // Stats job queued via add with delay
      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_TRENDING_STATS,
        expect.objectContaining({ since: expect.any(String), limit: expect.any(Number) }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it('should not queue stats job if syncStats is false', async () => {
      ingestionQueue.getJob.mockResolvedValue(null);

      const job = {
        name: IngestionJob.SYNC_TRENDING_DISPATCHER,
        data: { pages: 1, syncStats: false },
        id: 'disp-2',
      } as Job;

      await worker.process(job);

      // Should queue only page jobs, no stats job
      const statsJobCalls = (ingestionQueue.add as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0] === IngestionJob.SYNC_TRENDING_STATS,
      );
      expect(statsJobCalls).toHaveLength(0);

      // Page job should still be pre-checked
      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('processTrendingPage', () => {
    it('should enqueue sync jobs for new trending items', async () => {
      const mockItems = [
        { tmdbId: 100, type: MediaType.MOVIE },
        { tmdbId: 200, type: MediaType.MOVIE },
      ];
      syncService.getTrending.mockResolvedValue(mockItems);
      ingestionQueue.getJob.mockResolvedValue(null); // No existing jobs

      const job = {
        name: IngestionJob.SYNC_TRENDING_PAGE,
        data: { page: 1, type: MediaType.MOVIE },
        id: 'page-1',
      } as Job;

      await worker.process(job);

      expect(syncService.getTrending).toHaveBeenCalledWith(1, MediaType.MOVIE);

      // Should check for existing jobs
      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);

      // Enqueues jobs via addBulk
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: expect.objectContaining({ tmdbId: 100, trending: { score: 10000, rank: 1 } }),
          opts: expect.objectContaining({ jobId: expect.stringContaining('movie_100_') }),
        }),
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: expect.objectContaining({ tmdbId: 200, trending: { score: 9999, rank: 2 } }),
          opts: expect.objectContaining({ jobId: expect.stringContaining('movie_200_') }),
        }),
      ]);
    });

    it('should skip already queued items (dedupe)', async () => {
      const mockItems = [
        { tmdbId: 100, type: MediaType.MOVIE },
        { tmdbId: 200, type: MediaType.MOVIE },
      ];
      syncService.getTrending.mockResolvedValue(mockItems);

      // Mock: job for 100 exists, 200 does not
      ingestionQueue.getJob.mockImplementation((jobId: string) => {
        if (jobId.includes('movie_100_')) {
          return Promise.resolve({ id: 'existing' } as Job);
        }
        return Promise.resolve(null);
      });

      const job = {
        name: IngestionJob.SYNC_TRENDING_PAGE,
        data: { page: 1, type: MediaType.MOVIE },
        id: 'page-2',
      } as Job;

      await worker.process(job);

      // Only 1 job enqueued (second item), first was deduped
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_MOVIE,
          data: expect.objectContaining({ tmdbId: 200 }),
          opts: expect.any(Object),
        }),
      ]);
    });

    it('should not enqueue jobs if no items found', async () => {
      syncService.getTrending.mockResolvedValue([]);

      const job = {
        name: IngestionJob.SYNC_TRENDING_PAGE,
        data: { page: 1, type: MediaType.MOVIE },
        id: 'page-3',
      } as Job;

      await worker.process(job);

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
    });
  });

  describe('processTrendingStats', () => {
    it('should call statsService.syncTrendingStatsForUpdatedItems with since and limit', async () => {
      statsService.syncTrendingStatsForUpdatedItems = jest.fn().mockResolvedValue({
        movies: 50,
        shows: 50,
      });

      const since = new Date().toISOString();
      const job = {
        name: IngestionJob.SYNC_TRENDING_STATS,
        data: { since, limit: 200 },
        id: 'stats-1',
      } as Job;

      await worker.process(job);

      expect(statsService.syncTrendingStatsForUpdatedItems).toHaveBeenCalledWith({
        since: expect.any(Date),
        limit: 200,
      });
    });

    it('should use default limit if not provided', async () => {
      statsService.syncTrendingStatsForUpdatedItems = jest.fn().mockResolvedValue({
        movies: 10,
        shows: 10,
      });

      const job = {
        name: IngestionJob.SYNC_TRENDING_STATS,
        data: {},
        id: 'stats-2',
      } as Job;

      await worker.process(job);

      expect(statsService.syncTrendingStatsForUpdatedItems).toHaveBeenCalledWith({
        since: undefined,
        limit: 200,
      });
    });
  });
});
