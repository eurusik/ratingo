import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from './ingestion.controller';
import { SyncMediaService } from '../../application/services/sync-media.service';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { MEDIA_REPOSITORY } from '../../../catalog/domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { destroyTraktRateLimiter } from '../../infrastructure/adapters/trakt/base-trakt-http';

// Cleanup rate limiter interval to prevent Jest from hanging
afterAll(() => {
  destroyTraktRateLimiter();
});

describe('IngestionController', () => {
  let controller: IngestionController;
  let mockQueue: any;
  let mockMediaRepo: any;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const mockSyncService = {}; // Not used directly in controller methods we test
    mockMediaRepo = {
      findByTmdbId: jest.fn().mockResolvedValue(null), // Default: not found
      upsertStub: jest.fn().mockResolvedValue({ id: 'stub-1', slug: 'stub-slug' }),
    };
    const mockTmdbAdapter = {
      getMovie: jest.fn().mockResolvedValue(null),
      getShow: jest.fn().mockResolvedValue(null),
    };

    moduleRef = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        { provide: getQueueToken(INGESTION_QUEUE), useValue: mockQueue },
        { provide: SyncMediaService, useValue: mockSyncService },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepo },
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
      ],
    }).compile();

    controller = moduleRef.get<IngestionController>(IngestionController);
  });

  describe('syncTrackedShows', () => {
    it('should queue tracked shows dispatcher with hour window jobId', async () => {
      await controller.syncTrackedShows();

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_TRACKED_SHOWS,
        expect.objectContaining({ window: expect.any(String) }),
        expect.objectContaining({ jobId: expect.stringMatching(/^tracked_shows_\d{10}$/) }),
      );
    });

    it('should queue tracked shows dispatcher with force=true (unique jobId)', async () => {
      await controller.syncTrackedShows('true');

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_TRACKED_SHOWS,
        expect.objectContaining({ window: expect.any(String) }),
        expect.objectContaining({ jobId: expect.stringMatching(/^tracked_shows_\d+$/) }),
      );
    });
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('sync', () => {
    it('should queue movie sync job', async () => {
      const dto = { tmdbId: 550, type: MediaType.MOVIE };
      const res = await controller.sync(dto);

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_MOVIE, { tmdbId: 550 });
      expect(res.jobId).toBe('job-1');
    });

    it('should queue show sync job', async () => {
      const dto = { tmdbId: 100, type: MediaType.SHOW };
      const res = await controller.sync(dto);

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_SHOW, { tmdbId: 100 });
      expect(res.jobId).toBe('job-1');
    });
  });

  describe('syncTrending', () => {
    it('should queue trending sync job with query params', async () => {
      await controller.syncTrending('2', undefined, 'false', undefined, undefined, {});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_DISPATCHER, {
        pages: 2,
        syncStats: false,
        force: false,
      });
    });

    it('should queue legacy trending sync job with page query', async () => {
      await controller.syncTrending(undefined, '1', undefined, MediaType.SHOW, undefined, {});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_FULL, {
        page: 1,
        syncStats: true,
        type: MediaType.SHOW,
      });
    });

    it('should use default pages=5 when not specified', async () => {
      await controller.syncTrending(undefined, undefined, undefined, undefined, undefined, {});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_DISPATCHER, {
        pages: 5,
        syncStats: true,
        force: false,
      });
    });

    it('should bypass dedupe when force=true', async () => {
      await controller.syncTrending('1', undefined, undefined, undefined, 'true', {});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_DISPATCHER, {
        pages: 1,
        syncStats: true,
        force: true,
      });
    });
  });

  describe('syncNowPlaying', () => {
    it('should queue now playing sync job', async () => {
      await controller.syncNowPlaying({ region: 'US' });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_NOW_PLAYING, {
        region: 'US',
      });
    });

    it('should use default region when not provided', async () => {
      await controller.syncNowPlaying({});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_NOW_PLAYING, {
        region: 'UA',
      });
    });
  });

  describe('syncNewReleases', () => {
    it('should queue new releases sync job', async () => {
      await controller.syncNewReleases({ region: 'UA', daysBack: 60 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_NEW_RELEASES,
        {
          region: 'UA',
          daysBack: 60,
          force: false,
        },
        expect.any(Object),
      );
    });

    it('should use default values when not provided', async () => {
      await controller.syncNewReleases({});

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_NEW_RELEASES,
        {
          region: 'UA',
          daysBack: 30,
          force: false,
        },
        expect.any(Object),
      );
    });
  });

  describe('updateNowPlayingFlags', () => {
    it('should queue flag update job', async () => {
      await controller.updateNowPlayingFlags({ region: 'UA' });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.UPDATE_NOW_PLAYING_FLAGS, {
        region: 'UA',
      });
    });
  });

  describe('syncSnapshots', () => {
    it('should queue snapshots sync job', async () => {
      await controller.syncSnapshots();

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
        {
          region: 'global',
        },
        expect.objectContaining({ jobId: expect.stringMatching(/^snapshots_global_\d{8}$/) }),
      );
    });

    it('should queue snapshots dispatcher with region from query', async () => {
      await controller.syncSnapshots('UA');

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
        {
          region: 'UA',
        },
        expect.objectContaining({ jobId: expect.stringMatching(/^snapshots_UA_\d{8}$/) }),
      );
    });

    it('should queue snapshots dispatcher with force=true (unique jobId)', async () => {
      await controller.syncSnapshots('UA', 'true');

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
        {
          region: 'UA',
        },
        expect.objectContaining({ jobId: expect.stringMatching(/^snapshots_UA_\d+$/) }),
      );
    });
  });

  describe('getJobStatus', () => {
    const makeJob = (state: string, overrides: Partial<any> = {}) => ({
      id: 'job-42',
      getState: jest.fn().mockResolvedValue(state),
      failedReason: null,
      finishedOn: null,
      processedOn: null,
      timestamp: Date.now(),
      ...overrides,
    });

    it('maps waiting/delayed to queued', async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue(makeJob('waiting'));
      const res = await controller.getJobStatus('job-42');
      expect(res.status).toBe('queued');

      mockQueue.getJob = jest.fn().mockResolvedValue(makeJob('delayed'));
      const res2 = await controller.getJobStatus('job-42');
      expect(res2.status).toBe('queued');
    });

    it('maps active to processing', async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue(makeJob('active'));
      const res = await controller.getJobStatus('job-42');
      expect(res.status).toBe('processing');
    });

    it('maps completed to ready and sets updatedAt', async () => {
      const finishedOn = Date.now();
      mockQueue.getJob = jest.fn().mockResolvedValue(makeJob('completed', { finishedOn }));
      const res = await controller.getJobStatus('job-42');
      expect(res.status).toBe('ready');
      expect(res.updatedAt).toBe(new Date(finishedOn).toISOString());
    });

    it('returns slug when job is completed and has tmdbId', async () => {
      const finishedOn = Date.now();
      mockQueue.getJob = jest
        .fn()
        .mockResolvedValue(makeJob('completed', { finishedOn, data: { tmdbId: 550 } }));
      // Mock findByTmdbId to return media with slug
      mockMediaRepo.findByTmdbId.mockResolvedValue({ id: 'media-1', slug: 'test-movie-slug' });

      const res = await controller.getJobStatus('job-42');
      expect(res.status).toBe('ready');
      expect(res.slug).toBe('test-movie-slug');
    });

    it('returns null slug when job is not completed', async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue(makeJob('active', { data: { tmdbId: 550 } }));
      const res = await controller.getJobStatus('job-42');
      expect(res.status).toBe('processing');
      expect(res.slug).toBeNull();
    });

    it('maps failed to failed and returns errorMessage', async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue(makeJob('failed', { failedReason: 'boom' }));
      const res = await controller.getJobStatus('job-42');
      expect(res.status).toBe('failed');
      expect(res.errorMessage).toBe('boom');
    });

    it('throws NotFound when job is missing', async () => {
      mockQueue.getJob = jest.fn().mockResolvedValue(null);
      await expect(controller.getJobStatus('missing')).rejects.toThrow('Job not found');
    });
  });
});
