import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from './ingestion.controller';
import { SyncMediaService } from '@/modules/ingestion/application/services/sync-media.service';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE, IngestionJob } from '@/modules/ingestion/ingestion.constants';
import { MediaType } from '@/common/enums/media-type.enum';
import { destroyTraktRateLimiter } from '@/modules/trakt/infrastructure/adapters/base-trakt-http';
import { DEFAULT_REGION } from '@/common/constants';
import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { IngestionJobStatusService } from '@/modules/ingestion/application/services/ingestion-job-status.service';
import { JOB_STATUS } from '@/common/enums/job-status.enum';

// Cleanup rate limiter interval to prevent Jest from hanging
afterAll(() => {
  destroyTraktRateLimiter();
});

describe('IngestionController', () => {
  let controller: IngestionController;
  let mockQueue: any;
  let mockSyncService: any;
  let mockJobStatusService: { getJobStatus: jest.Mock };
  let moduleRef: TestingModule | undefined;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn(),
    };

    mockSyncService = {
      findExistingMedia: jest.fn().mockResolvedValue(null),
      createStubForIngestion: jest.fn().mockResolvedValue({
        id: 'stub-1',
        slug: 'stub-slug',
        title: 'Test Movie',
      }),
      getSlugByTmdbId: jest.fn().mockResolvedValue(null),
    };

    mockJobStatusService = { getJobStatus: jest.fn() };

    moduleRef = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        { provide: getQueueToken(INGESTION_QUEUE), useValue: mockQueue },
        { provide: SyncMediaService, useValue: mockSyncService },
        { provide: IngestionJobStatusService, useValue: mockJobStatusService },
      ],
    }).compile();

    controller = moduleRef.get<IngestionController>(IngestionController);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('sync', () => {
    it('should queue movie sync job', async () => {
      const dto = { tmdbId: 550, type: MediaType.MOVIE };
      const res = await controller.sync(dto);

      expect(mockSyncService.findExistingMedia).toHaveBeenCalledWith(550, MediaType.MOVIE);
      expect(mockSyncService.createStubForIngestion).toHaveBeenCalledWith(550, MediaType.MOVIE);
      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_MOVIE, { tmdbId: 550 });
      expect(res.jobId).toBe('job-1');
      expect(res.status).toBe('queued');
    });

    it('should queue show sync job', async () => {
      const dto = { tmdbId: 100, type: MediaType.SHOW };
      const res = await controller.sync(dto);

      expect(mockSyncService.createStubForIngestion).toHaveBeenCalledWith(100, MediaType.SHOW);
      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_SHOW, { tmdbId: 100 });
      expect(res.jobId).toBe('job-1');
    });

    it('should return existing media without queueing when not forced', async () => {
      mockSyncService.findExistingMedia.mockResolvedValue({
        id: 'existing-1',
        type: MediaType.MOVIE,
        slug: 'existing-slug',
        ingestionStatus: IngestionStatus.READY,
      });

      const dto = { tmdbId: 550, type: MediaType.MOVIE };
      const res = await controller.sync(dto);

      expect(res.status).toBe('exists');
      expect(res.id).toBe('existing-1');
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should queue sync when force=true even if exists', async () => {
      mockSyncService.findExistingMedia.mockResolvedValue({
        id: 'existing-1',
        type: MediaType.MOVIE,
        slug: 'existing-slug',
        ingestionStatus: IngestionStatus.READY,
      });

      const dto = { tmdbId: 550, type: MediaType.MOVIE, force: true };
      const res = await controller.sync(dto);

      expect(res.status).toBe('queued');
      expect(mockQueue.add).toHaveBeenCalled();
    });
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

  describe('syncTrending', () => {
    it('should queue trending sync job with query params', async () => {
      await controller.syncTrending({ pages: 2 }, undefined, 'false', undefined, {});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_DISPATCHER, {
        pages: 2,
        syncStats: false,
        force: false,
      });
    });

    it('should queue legacy trending sync job with page query', async () => {
      await controller.syncTrending({ type: MediaType.SHOW }, '1', undefined, undefined, {});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_FULL, {
        page: 1,
        syncStats: true,
        type: MediaType.SHOW,
      });
    });

    it('should use default pages=10 when not specified', async () => {
      await controller.syncTrending({}, undefined, undefined, undefined, {});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_DISPATCHER, {
        pages: 10,
        syncStats: true,
        force: false,
      });
    });

    it('should bypass dedupe when force=true', async () => {
      await controller.syncTrending({ pages: 1 }, undefined, undefined, 'true', {});

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
        region: DEFAULT_REGION,
      });
    });
  });

  describe('syncNewReleases', () => {
    it('should queue new releases sync job', async () => {
      await controller.syncNewReleases({ region: DEFAULT_REGION, daysBack: 60 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_NEW_RELEASES,
        {
          region: DEFAULT_REGION,
          daysBack: 60,
          force: false,
        },
        expect.any(Object),
      );
    });

    it('should report deduped=false when no job with that id existed', async () => {
      mockQueue.getJob.mockResolvedValue(undefined);

      const result = await controller.syncNewReleases({ region: DEFAULT_REGION, daysBack: 60 });

      expect(result.deduped).toBe(false);
    });

    it('should report deduped=true when a job with that id already existed', async () => {
      mockQueue.getJob.mockResolvedValue({ id: 'existing' });

      const result = await controller.syncNewReleases({ region: DEFAULT_REGION, daysBack: 60 });

      expect(result.deduped).toBe(true);
    });

    it('should report deduped=false and skip the lookup when forced', async () => {
      mockQueue.getJob.mockResolvedValue({ id: 'existing' });

      const result = await controller.syncNewReleases({
        region: DEFAULT_REGION,
        daysBack: 60,
        force: true,
      });

      expect(result.deduped).toBe(false);
      expect(mockQueue.getJob).not.toHaveBeenCalled();
    });

    it('should use default values when not provided', async () => {
      await controller.syncNewReleases({});

      expect(mockQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_NEW_RELEASES,
        {
          region: 'US',
          daysBack: 30,
          force: false,
        },
        expect.any(Object),
      );
    });
  });

  describe('updateNowPlayingFlags', () => {
    it('should queue flag update job', async () => {
      await controller.updateNowPlayingFlags({ region: DEFAULT_REGION });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.UPDATE_NOW_PLAYING_FLAGS, {
        region: DEFAULT_REGION,
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
    it('maps the job status to the response and serialises updatedAt', async () => {
      const updatedAt = new Date('2026-01-01T00:00:00.000Z');
      mockJobStatusService.getJobStatus.mockResolvedValue({
        id: 'job-42',
        status: JOB_STATUS.READY,
        errorMessage: null,
        updatedAt,
        tmdbId: 550,
        mediaType: MediaType.MOVIE,
        slug: 'test-movie-slug',
      });

      const res = await controller.getJobStatus('job-42');

      expect(mockJobStatusService.getJobStatus).toHaveBeenCalledWith('job-42');
      expect(res).toEqual({
        id: 'job-42',
        status: JOB_STATUS.READY,
        errorMessage: null,
        updatedAt: updatedAt.toISOString(),
        slug: 'test-movie-slug',
      });
    });

    it('returns null updatedAt when the job has no activity time', async () => {
      mockJobStatusService.getJobStatus.mockResolvedValue({
        id: 'job-42',
        status: JOB_STATUS.FAILED,
        errorMessage: 'boom',
        updatedAt: null,
        tmdbId: null,
        mediaType: undefined,
        slug: null,
      });

      const res = await controller.getJobStatus('job-42');

      expect(res).toMatchObject({
        status: JOB_STATUS.FAILED,
        errorMessage: 'boom',
        updatedAt: null,
      });
    });

    it('throws NotFound when job is missing', async () => {
      mockJobStatusService.getJobStatus.mockResolvedValue(null);
      await expect(controller.getJobStatus('missing')).rejects.toThrow('Job not found');
    });
  });
});
