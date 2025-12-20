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
  let statsService: any;
  let subscriptionTriggerService: any;
  let userSubscriptionRepository: any;

  beforeEach(async () => {
    syncService = {
      syncMovie: jest.fn(),
      syncShow: jest.fn(),
      getTrending: jest.fn(),
    };

    snapshotsService = {
      syncDailySnapshots: jest.fn(),
    };

    trackedSyncService = {
      syncTrackedShows: jest.fn(),
    };

    tmdbAdapter = {
      getNowPlayingIds: jest.fn(),
      getNewReleaseIds: jest.fn(),
    };

    ingestionQueue = {
      add: jest.fn(),
      addBulk: jest.fn(),
      getJob: jest.fn(),
    };

    movieRepository = {
      setNowPlaying: jest.fn(),
    };

    statsService = {
      syncTrendingStats: jest.fn(),
      syncTrendingStatsForUpdatedItems: jest.fn(),
    };

    subscriptionTriggerService = {
      handleNewEpisode: jest.fn(),
      handleNewSeason: jest.fn(),
    };

    userSubscriptionRepository = {
      findTrackedShowTmdbIds: jest.fn(),
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

    it('should process UPDATE_NOW_PLAYING_FLAGS', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([1, 2, 3]);
      const job = {
        name: IngestionJob.UPDATE_NOW_PLAYING_FLAGS,
        data: { region: 'UA' },
        id: '3',
      } as Job;

      await worker.process(job);

      expect(tmdbAdapter.getNowPlayingIds).toHaveBeenCalledWith('UA');
      expect(movieRepository.setNowPlaying).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('should process SYNC_SNAPSHOTS job', async () => {
      const job = { name: IngestionJob.SYNC_SNAPSHOTS, data: {}, id: '5' } as Job;
      await worker.process(job);
      expect(snapshotsService.syncDailySnapshots).toHaveBeenCalled();
    });
  });

  describe('processNowPlaying (private)', () => {
    it('should sync now playing movies (via job processing)', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([10, 20]);
      const job = { name: IngestionJob.SYNC_NOW_PLAYING, data: { region: 'US' }, id: '4' } as Job;

      await worker.process(job);

      expect(tmdbAdapter.getNowPlayingIds).toHaveBeenCalledWith('US');
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 10 } },
        { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 20 } },
      ]);
    });
  });

  describe('processNewReleases', () => {
    it('should queue new releases sync jobs', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([30, 40]);
      const job = {
        name: IngestionJob.SYNC_NEW_RELEASES,
        data: { region: 'GB', daysBack: 60 },
        id: '6',
      } as Job;

      await worker.process(job);

      expect(tmdbAdapter.getNewReleaseIds).toHaveBeenCalledWith(60, 'GB');
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 30 } },
        { name: IngestionJob.SYNC_MOVIE, data: { tmdbId: 40 } },
      ]);
    });

    it('should do nothing if no new releases found', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([]);
      const job = { name: IngestionJob.SYNC_NEW_RELEASES, data: { region: 'US' }, id: '7' } as Job;

      await worker.process(job);

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
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
      // Stats job queued via add with delay
      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_TRENDING_STATS,
        expect.objectContaining({ since: expect.any(String), limit: expect.any(Number) }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it('should not queue stats job if syncStats is false', async () => {
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
      // Enqueues jobs one by one with dedupe check
      expect(ingestionQueue.add).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_MOVIE,
        expect.objectContaining({ tmdbId: 100, trending: { score: 10000, rank: 1 } }),
        expect.objectContaining({ jobId: expect.stringContaining('movie_100_') }),
      );
    });

    it('should skip already queued items (dedupe)', async () => {
      const mockItems = [
        { tmdbId: 100, type: MediaType.MOVIE },
        { tmdbId: 200, type: MediaType.MOVIE },
      ];
      syncService.getTrending.mockResolvedValue(mockItems);
      // First item exists, second doesn't
      ingestionQueue.getJob.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);

      const job = {
        name: IngestionJob.SYNC_TRENDING_PAGE,
        data: { page: 1, type: MediaType.MOVIE },
        id: 'page-2',
      } as Job;

      await worker.process(job);

      // Only 1 job enqueued (second item), first was deduped
      expect(ingestionQueue.add).toHaveBeenCalledTimes(1);
      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_MOVIE,
        expect.objectContaining({ tmdbId: 200 }),
        expect.any(Object),
      );
    });

    it('should not enqueue jobs if no items found', async () => {
      syncService.getTrending.mockResolvedValue([]);

      const job = {
        name: IngestionJob.SYNC_TRENDING_PAGE,
        data: { page: 1, type: MediaType.MOVIE },
        id: 'page-3',
      } as Job;

      await worker.process(job);

      expect(ingestionQueue.add).not.toHaveBeenCalled();
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
