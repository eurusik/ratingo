import { Test, TestingModule } from '@nestjs/testing';
import { TrackedShowsPipeline } from './tracked-shows.pipeline';
import { TrackedSyncService } from '../services/tracked-sync.service';
import { BulkJobService } from '../services/bulk-job.service';
import { SubscriptionTriggerService } from '../../../user-actions/application/subscription-trigger.service';
import { USER_SUBSCRIPTION_REPOSITORY } from '../../../user-actions/domain/repositories/user-subscription.repository.interface';
import { IngestionJob } from '../../ingestion.constants';

describe('TrackedShowsPipeline', () => {
  let pipeline: TrackedShowsPipeline;
  let trackedSyncService: jest.Mocked<TrackedSyncService>;
  let bulkJobService: jest.Mocked<BulkJobService>;
  let subscriptionTriggerService: jest.Mocked<SubscriptionTriggerService>;
  let subscriptionRepository: any;

  beforeEach(async () => {
    const mockTrackedSyncService = {
      syncShowWithDiff: jest.fn().mockResolvedValue({ hasChanges: false }),
    };

    const mockBulkJobService = {
      enqueueBulk: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
      enqueueBatch: jest
        .fn()
        .mockImplementation(
          (jobs, logger, context, cumulative = { found: 0, enqueued: 0, deduped: 0 }) =>
            Promise.resolve({
              found: cumulative.found + jobs.length,
              enqueued: cumulative.enqueued + jobs.length,
              deduped: cumulative.deduped,
            }),
        ),
    };

    const mockSubscriptionTriggerService = {
      handleShowDiff: jest.fn().mockResolvedValue([]),
    };

    const mockSubscriptionRepository = {
      findTrackedShowTmdbIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackedShowsPipeline,
        { provide: TrackedSyncService, useValue: mockTrackedSyncService },
        { provide: BulkJobService, useValue: mockBulkJobService },
        { provide: SubscriptionTriggerService, useValue: mockSubscriptionTriggerService },
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: mockSubscriptionRepository },
      ],
    }).compile();

    pipeline = module.get<TrackedShowsPipeline>(TrackedShowsPipeline);
    trackedSyncService = module.get(TrackedSyncService);
    bulkJobService = module.get(BulkJobService);
    subscriptionTriggerService = module.get(SubscriptionTriggerService);
    subscriptionRepository = module.get(USER_SUBSCRIPTION_REPOSITORY);
  });

  describe('dispatch', () => {
    it('should fetch tracked shows and enqueue batch jobs', async () => {
      const tmdbIds = Array.from({ length: 100 }, (_, i) => i + 1);
      subscriptionRepository.findTrackedShowTmdbIds.mockResolvedValue(tmdbIds);

      await pipeline.dispatch();

      expect(subscriptionRepository.findTrackedShowTmdbIds).toHaveBeenCalled();
      expect(bulkJobService.enqueueBatch).toHaveBeenCalled();
    });

    it('should use stable hash-based jobIds', async () => {
      subscriptionRepository.findTrackedShowTmdbIds.mockResolvedValue([1, 2, 3]);

      await pipeline.dispatch('2025122119');

      expect(bulkJobService.enqueueBatch).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            name: IngestionJob.SYNC_TRACKED_SHOW_BATCH,
            opts: expect.objectContaining({
              jobId: expect.stringMatching(/^tracked_batch_2025122119_[a-f0-9]{12}$/),
            }),
          }),
        ],
        expect.any(Object),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should skip if no tracked shows found', async () => {
      subscriptionRepository.findTrackedShowTmdbIds.mockResolvedValue([]);

      await pipeline.dispatch();

      expect(bulkJobService.enqueueBatch).not.toHaveBeenCalled();
    });
  });

  describe('processBatch', () => {
    it('should sync shows with diff detection', async () => {
      trackedSyncService.syncShowWithDiff.mockResolvedValue({ hasChanges: false } as any);

      await pipeline.processBatch([100, 200]);

      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledTimes(2);
      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledWith(100);
      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledWith(200);
    });

    it('should trigger notifications for shows with changes', async () => {
      trackedSyncService.syncShowWithDiff.mockResolvedValue({
        hasChanges: true,
        mediaItemId: 'show-1',
      } as any);
      subscriptionTriggerService.handleShowDiff.mockResolvedValue([{ id: 'event-1' }] as any);

      await pipeline.processBatch([100]);

      expect(subscriptionTriggerService.handleShowDiff).toHaveBeenCalledWith({
        hasChanges: true,
        mediaItemId: 'show-1',
      });
    });

    it('should continue on error', async () => {
      trackedSyncService.syncShowWithDiff
        .mockRejectedValueOnce(new Error('Sync failed'))
        .mockResolvedValueOnce({ hasChanges: false } as any);

      await pipeline.processBatch([100, 200]);

      expect(trackedSyncService.syncShowWithDiff).toHaveBeenCalledTimes(2);
    });
  });
});
