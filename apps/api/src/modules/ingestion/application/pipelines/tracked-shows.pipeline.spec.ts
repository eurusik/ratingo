import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { TrackedShowsPipeline } from './tracked-shows.pipeline';
import { TrackedSyncService } from '../services/tracked-sync.service';
import { SubscriptionTriggerService } from '../../../user-actions/application/subscription-trigger.service';
import { USER_SUBSCRIPTION_REPOSITORY } from '../../../user-actions/domain/repositories/user-subscription.repository.interface';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';

describe('TrackedShowsPipeline', () => {
  let pipeline: TrackedShowsPipeline;
  let trackedSyncService: any;
  let subscriptionTriggerService: any;
  let subscriptionRepository: any;
  let ingestionQueue: any;

  beforeEach(async () => {
    trackedSyncService = {
      syncShowWithDiff: jest.fn().mockResolvedValue({ hasChanges: false }),
    };

    subscriptionTriggerService = {
      handleShowDiff: jest.fn().mockResolvedValue([]),
    };

    subscriptionRepository = {
      findTrackedShowTmdbIds: jest.fn().mockResolvedValue([]),
    };

    ingestionQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      addBulk: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackedShowsPipeline,
        { provide: TrackedSyncService, useValue: trackedSyncService },
        { provide: SubscriptionTriggerService, useValue: subscriptionTriggerService },
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: subscriptionRepository },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
      ],
    }).compile();

    pipeline = module.get<TrackedShowsPipeline>(TrackedShowsPipeline);
  });

  describe('dispatch', () => {
    it('should fetch tracked shows and enqueue batch jobs', async () => {
      const tmdbIds = Array.from({ length: 100 }, (_, i) => i + 1);
      subscriptionRepository.findTrackedShowTmdbIds.mockResolvedValue(tmdbIds);

      await pipeline.dispatch();

      expect(subscriptionRepository.findTrackedShowTmdbIds).toHaveBeenCalled();
      expect(ingestionQueue.addBulk).toHaveBeenCalled();
      const addBulkCalls = (ingestionQueue.addBulk as jest.Mock).mock.calls;
      const totalJobsEnqueued = addBulkCalls.reduce((sum, call) => sum + call[0].length, 0);
      expect(totalJobsEnqueued).toBe(2); // 100 shows / 50 per chunk = 2 batches
    });

    it('should use stable hash-based jobIds', async () => {
      subscriptionRepository.findTrackedShowTmdbIds.mockResolvedValue([1, 2, 3]);

      await pipeline.dispatch('2025122119');

      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: IngestionJob.SYNC_TRACKED_SHOW_BATCH,
          opts: expect.objectContaining({
            jobId: expect.stringMatching(/^tracked_batch_2025122119_[a-f0-9]{12}$/),
          }),
        }),
      ]);
    });

    it('should deduplicate batch jobs', async () => {
      subscriptionRepository.findTrackedShowTmdbIds.mockResolvedValue([1, 2, 3]);
      ingestionQueue.getJob.mockResolvedValue({ id: 'existing' });

      await pipeline.dispatch();

      expect(ingestionQueue.getJob).toHaveBeenCalled();
      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
    });

    it('should skip if no tracked shows found', async () => {
      subscriptionRepository.findTrackedShowTmdbIds.mockResolvedValue([]);

      await pipeline.dispatch();

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
    });
  });

  describe('processBatch', () => {
    it('should sync shows with diff detection', async () => {
      trackedSyncService.syncShowWithDiff.mockResolvedValue({ hasChanges: false });

      await pipeline.processBatch([100, 200]);

      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledTimes(2);
      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledWith(100);
      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledWith(200);
    });

    it('should trigger notifications for shows with changes', async () => {
      trackedSyncService.syncShowWithDiff.mockResolvedValue({
        hasChanges: true,
        mediaItemId: 'show-1',
      });
      subscriptionTriggerService.handleShowDiff.mockResolvedValue([{ id: 'event-1' }]);

      await pipeline.processBatch([100]);

      expect(subscriptionTriggerService.handleShowDiff).toHaveBeenCalledWith({
        hasChanges: true,
        mediaItemId: 'show-1',
      });
    });

    it('should continue on error', async () => {
      trackedSyncService.syncShowWithDiff
        .mockRejectedValueOnce(new Error('Sync failed'))
        .mockResolvedValueOnce({ hasChanges: false });

      await pipeline.processBatch([100, 200]);

      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledTimes(2);
    });
  });
});
