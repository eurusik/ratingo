import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from './ingestion.controller';
import { SyncMediaService } from '../../application/services/sync-media.service';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { MEDIA_REPOSITORY } from '../../../catalog/domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';

describe('IngestionController', () => {
  let controller: IngestionController;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const mockSyncService = {}; // Not used directly in controller methods we test
    const mockMediaRepo = {
      findByTmdbId: jest.fn().mockResolvedValue(null),
      upsertStub: jest.fn().mockResolvedValue({ id: 'stub-1', slug: 'stub-slug' }),
    };
    const mockTmdbAdapter = {
      getMovie: jest.fn().mockResolvedValue(null),
      getShow: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        { provide: getQueueToken(INGESTION_QUEUE), useValue: mockQueue },
        { provide: SyncMediaService, useValue: mockSyncService },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepo },
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
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
    it('should queue trending sync job', async () => {
      await controller.syncTrending({ page: 2, syncStats: false });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_FULL, {
        page: 2,
        syncStats: false,
        type: undefined,
      });
    });

    it('should queue trending sync job with type', async () => {
      await controller.syncTrending({ page: 1, syncStats: true, type: MediaType.SHOW });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_FULL, {
        page: 1,
        syncStats: true,
        type: MediaType.SHOW,
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

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_NEW_RELEASES, {
        region: 'UA',
        daysBack: 60,
      });
    });

    it('should use default values when not provided', async () => {
      await controller.syncNewReleases({});

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_NEW_RELEASES, {
        region: 'UA',
        daysBack: 30,
      });
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

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_SNAPSHOTS, {});
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
