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
      const job = { name: IngestionJob.SYNC_SHOW, data: { tmdbId: 100, trendingScore: 0.5 }, id: '2' } as Job;
      await worker.process(job);
      expect(syncService.syncShow).toHaveBeenCalledWith(100, 0.5);
    });

    it('should process UPDATE_NOW_PLAYING_FLAGS', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([1, 2, 3]);
      const job = { name: IngestionJob.UPDATE_NOW_PLAYING_FLAGS, data: { region: 'UA' }, id: '3' } as Job;
      
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
});
