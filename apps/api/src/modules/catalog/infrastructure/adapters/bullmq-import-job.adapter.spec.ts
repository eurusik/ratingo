import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';

import { JOB_STATUS } from '@/common/enums/job-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';
import { INGESTION_QUEUE, IngestionJob } from '@/modules/shared/contracts';

import { BullMQImportJobAdapter } from './bullmq-import-job.adapter';

describe('BullMQImportJobAdapter', () => {
  let adapter: BullMQImportJobAdapter;
  let queue: any;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullMQImportJobAdapter,
        { provide: getQueueToken(INGESTION_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    adapter = module.get<BullMQImportJobAdapter>(BullMQImportJobAdapter);
    queue = module.get(getQueueToken(INGESTION_QUEUE));
  });

  describe('queueImport', () => {
    beforeEach(() => {
      queue.getJob.mockResolvedValue(null);
    });

    it('should queue movie import with correct job name and ID', async () => {
      queue.add.mockResolvedValue({ id: 'sync-movie_123' });

      const result = await adapter.queueImport(123, MediaType.MOVIE);

      expect(queue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_MOVIE,
        { tmdbId: 123, userRequested: true },
        { jobId: 'sync-movie_123', priority: 1 },
      );
      expect(result.jobId).toBe('sync-movie_123');
    });

    it('should queue show import with correct job name and ID', async () => {
      queue.add.mockResolvedValue({ id: 'sync-show_456' });

      const result = await adapter.queueImport(456, MediaType.SHOW);

      expect(queue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_SHOW,
        { tmdbId: 456, userRequested: true },
        { jobId: 'sync-show_456', priority: 1 },
      );
      expect(result.jobId).toBe('sync-show_456');
    });

    it.each(['completed', 'failed'])(
      'should remove a retained %s job and re-add it',
      async (state) => {
        const remove = jest.fn().mockResolvedValue(undefined);
        queue.getJob.mockResolvedValue({
          id: 'sync-movie_123',
          getState: async () => state,
          remove,
        });
        queue.add.mockResolvedValue({ id: 'sync-movie_123' });

        const result = await adapter.queueImport(123, MediaType.MOVIE);

        expect(remove).toHaveBeenCalled();
        expect(queue.add).toHaveBeenCalled();
        expect(result).toEqual({ jobId: 'sync-movie_123', deduplicated: false });
      },
    );

    it.each(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'])(
      'should not re-add when a %s job is in flight',
      async (state) => {
        const remove = jest.fn();
        queue.getJob.mockResolvedValue({
          id: 'sync-movie_123',
          getState: async () => state,
          remove,
        });

        const result = await adapter.queueImport(123, MediaType.MOVIE);

        expect(remove).not.toHaveBeenCalled();
        expect(queue.add).not.toHaveBeenCalled();
        expect(result).toEqual({ jobId: 'sync-movie_123', deduplicated: true });
      },
    );

    it('should report deduplicated when removing a finished job fails (locked)', async () => {
      queue.getJob.mockResolvedValue({
        id: 'sync-movie_123',
        getState: async () => 'failed',
        remove: jest.fn().mockRejectedValue(new Error('locked')),
      });

      const result = await adapter.queueImport(123, MediaType.MOVIE);

      expect(queue.add).not.toHaveBeenCalled();
      expect(result.deduplicated).toBe(true);
    });
  });

  describe('hasActiveJob', () => {
    it('should return job ID when job is active', async () => {
      queue.getJob.mockResolvedValue({ id: 'sync-movie_123', getState: async () => 'active' });

      const result = await adapter.hasActiveJob(123, MediaType.MOVIE);

      expect(queue.getJob).toHaveBeenCalledWith('sync-movie_123');
      expect(result).toBe('sync-movie_123');
    });

    it('should return null when job does not exist', async () => {
      queue.getJob.mockResolvedValue(null);

      const result = await adapter.hasActiveJob(123, MediaType.MOVIE);

      expect(result).toBeNull();
    });

    it.each(['completed', 'failed'])('should return null for retained %s job', async (state) => {
      queue.getJob.mockResolvedValue({ id: 'sync-movie_123', getState: async () => state });

      const result = await adapter.hasActiveJob(123, MediaType.MOVIE);

      expect(result).toBeNull();
    });

    it('should use correct job ID for show type', async () => {
      queue.getJob.mockResolvedValue({ id: 'sync-show_456', getState: async () => 'waiting' });

      const result = await adapter.hasActiveJob(456, MediaType.SHOW);

      expect(queue.getJob).toHaveBeenCalledWith('sync-show_456');
      expect(result).toBe('sync-show_456');
    });
  });

  describe('getJobStatus', () => {
    it('should derive the media type from the job id (show jobs)', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('completed'),
        data: { tmdbId: 123 },
        failedReason: null,
      });

      const result = await adapter.getJobStatus('sync-show_123');

      expect(result?.type).toBe(MediaType.SHOW);
    });

    it('should return null when job does not exist', async () => {
      queue.getJob.mockResolvedValue(null);

      const result = await adapter.getJobStatus('sync-movie_123');

      expect(result).toBeNull();
    });

    it('should map waiting state to QUEUED', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('waiting'),
        data: { tmdbId: 123 },
        failedReason: null,
      });

      const result = await adapter.getJobStatus('sync-movie_123');

      expect(result).toEqual({
        status: JOB_STATUS.QUEUED,
        errorMessage: null,
        tmdbId: 123,
        type: MediaType.MOVIE,
      });
    });

    it('should map active state to PROCESSING', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('active'),
        data: { tmdbId: 123 },
        failedReason: null,
      });

      const result = await adapter.getJobStatus('sync-movie_123');

      expect(result).toEqual({
        status: JOB_STATUS.PROCESSING,
        errorMessage: null,
        tmdbId: 123,
        type: MediaType.MOVIE,
      });
    });

    it('should map completed state to READY', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('completed'),
        data: { tmdbId: 123 },
        failedReason: null,
      });

      const result = await adapter.getJobStatus('sync-movie_123');

      expect(result).toEqual({
        status: JOB_STATUS.READY,
        errorMessage: null,
        tmdbId: 123,
        type: MediaType.MOVIE,
      });
    });

    it('should map failed state to FAILED with error message', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('failed'),
        data: { tmdbId: 123 },
        failedReason: 'TMDB API timeout',
      });

      const result = await adapter.getJobStatus('sync-movie_123');

      expect(result).toEqual({
        status: JOB_STATUS.FAILED,
        errorMessage: 'TMDB API timeout',
        tmdbId: 123,
        type: MediaType.MOVIE,
      });
    });

    it('should map delayed state to QUEUED', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('delayed'),
        data: { tmdbId: 123 },
        failedReason: null,
      });

      const result = await adapter.getJobStatus('sync-movie_123');

      expect(result?.status).toBe(JOB_STATUS.QUEUED);
    });

    it('should map stalled state to FAILED', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('stalled'),
        data: { tmdbId: 123 },
        failedReason: null,
      });

      const result = await adapter.getJobStatus('sync-movie_123');

      expect(result?.status).toBe(JOB_STATUS.FAILED);
    });
  });

  describe('isValidImportJobId', () => {
    it('should return true for valid movie job ID', () => {
      expect(adapter.isValidImportJobId('sync-movie_123')).toBe(true);
      expect(adapter.isValidImportJobId('sync-movie_999999')).toBe(true);
    });

    it('should return true for valid show job ID', () => {
      expect(adapter.isValidImportJobId('sync-show_456')).toBe(true);
      expect(adapter.isValidImportJobId('sync-show_1')).toBe(true);
    });

    it('should return false for invalid job IDs', () => {
      expect(adapter.isValidImportJobId('invalid-job')).toBe(false);
      expect(adapter.isValidImportJobId('sync-trending_123')).toBe(false);
      expect(adapter.isValidImportJobId('movie_123')).toBe(false);
      expect(adapter.isValidImportJobId('')).toBe(false);
    });
  });
});
