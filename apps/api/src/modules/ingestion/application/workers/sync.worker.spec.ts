import { Test, TestingModule } from '@nestjs/testing';
import { SyncWorker } from './sync.worker';
import { SyncMediaService } from '../services/sync-media.service';
import { SnapshotsService } from '../services/snapshots.service';
import { TmdbAdapter } from '@/modules/tmdb/tmdb.adapter';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { Job } from 'bullmq';
import { StatsService } from '../../../stats/application/services/stats.service';
import { MOVIE_REPOSITORY } from '../../../catalog/domain/repositories/movie.repository.interface';

describe('SyncWorker', () => {
  let worker: SyncWorker;
  let syncService: any;
  let snapshotsService: any;
  let tmdbAdapter: any;
  let ingestionQueue: any;
  let movieRepository: any;
  let statsService: any;

  beforeEach(async () => {
    syncService = {
      syncMovie: jest.fn(),
      syncShow: jest.fn(),
      getTrending: jest.fn(),
    };

    snapshotsService = {
      syncDailySnapshots: jest.fn(),
    };

    tmdbAdapter = {
      getNowPlayingIds: jest.fn(),
      getNewReleaseIds: jest.fn(),
    };

    ingestionQueue = {
      add: jest.fn(),
      addBulk: jest.fn(),
    };

    movieRepository = {
      setNowPlaying: jest.fn(),
    };

    statsService = {
      syncTrendingStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncWorker,
        { provide: SyncMediaService, useValue: syncService },
        { provide: SnapshotsService, useValue: snapshotsService },
        { provide: TmdbAdapter, useValue: tmdbAdapter },
        { provide: StatsService, useValue: statsService },
        { provide: MOVIE_REPOSITORY, useValue: movieRepository },
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

    it('should process SYNC_SHOW job', async () => {
      const job = {
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId: 100, trendingScore: 0.5 },
        id: '2',
      } as Job;
      await worker.process(job);
      expect(syncService.syncShow).toHaveBeenCalledWith(100, 0.5);
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
      // Score = 10000 - ((1-1)*20 + i) -> 10000, 9999
      expect(syncService.syncMovie).toHaveBeenCalledWith(100, 10000);
      expect(syncService.syncShow).toHaveBeenCalledWith(200, 9999);
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
});
