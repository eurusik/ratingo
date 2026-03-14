import { type Queue } from 'bullmq';

import { IngestionJob } from '../../../ingestion/ingestion.constants';
import { IMPORT_PENDING_STATUS } from '../../domain/constants/import-pending.constants';
import { type ImportPendingItem } from '../../domain/entities/import-pending-item';
import { type IImportPendingRepository } from '../../domain/repositories/import-pending.repository.interface';

import { ResolveImportDispatcherPipeline } from './resolve-import-dispatcher.pipeline';

function makePendingItem(id: string, batchId: string): ImportPendingItem {
  return {
    id,
    batchId,
    imdbId: null,
    tmdbId: null,
    resolvedTmdbId: null,
    mediaType: null,
    title: null,
    rating: null,
    state: 'completed',
    status: IMPORT_PENDING_STATUS.PENDING,
    failureReason: null,
    mediaItemId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ResolveImportDispatcherPipeline', () => {
  let pendingRepo: jest.Mocked<IImportPendingRepository>;
  let backfillQueue: jest.Mocked<Pick<Queue, 'addBulk'>>;
  let pipeline: ResolveImportDispatcherPipeline;

  beforeEach(() => {
    pendingRepo = {
      createBatch: jest.fn(),
      createPendingItems: jest.fn(),
      createBatchWithItems: jest.fn(),
      findBatchById: jest.fn(),
      findActiveBatchesByUser: jest.fn(),
      findPendingByBatchAndStatus: jest.fn(),
      findById: jest.fn(),
      findItemsByResolvedTmdb: jest.fn(),
      updateItemStatus: jest.fn(),
      updateBatchCountersAtomic: jest.fn(),
    };

    backfillQueue = {
      addBulk: jest.fn().mockResolvedValue([]),
    };

    pipeline = new ResolveImportDispatcherPipeline(pendingRepo as any, backfillQueue as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('empty batch', () => {
    it('does not queue any jobs when no pending items exist', async () => {
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue([]);

      await pipeline.execute({ batchId: 'batch-1' });

      expect(backfillQueue.addBulk).not.toHaveBeenCalled();
    });

    it('queries repo with correct batch ID and PENDING status', async () => {
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue([]);

      await pipeline.execute({ batchId: 'batch-42' });

      expect(pendingRepo.findPendingByBatchAndStatus).toHaveBeenCalledWith(
        'batch-42',
        IMPORT_PENDING_STATUS.PENDING,
      );
    });
  });

  describe('batch with pending items', () => {
    it('creates one job per pending item', async () => {
      const items = [
        makePendingItem('item-1', 'batch-1'),
        makePendingItem('item-2', 'batch-1'),
        makePendingItem('item-3', 'batch-1'),
      ];
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue(items);

      await pipeline.execute({ batchId: 'batch-1' });

      expect(backfillQueue.addBulk).toHaveBeenCalledTimes(1);
      const [jobs] = (backfillQueue.addBulk as jest.Mock).mock.calls[0];
      expect(jobs).toHaveLength(3);
    });

    it('uses RESOLVE_IMPORT_ITEM job name for all jobs', async () => {
      const items = [makePendingItem('item-1', 'batch-1'), makePendingItem('item-2', 'batch-1')];
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue(items);

      await pipeline.execute({ batchId: 'batch-1' });

      const [jobs] = (backfillQueue.addBulk as jest.Mock).mock.calls[0];
      for (const job of jobs) {
        expect(job.name).toBe(IngestionJob.RESOLVE_IMPORT_ITEM);
      }
    });

    it('passes correct data payload to each job', async () => {
      const items = [makePendingItem('item-1', 'batch-1')];
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue(items);

      await pipeline.execute({ batchId: 'batch-1' });

      const [jobs] = (backfillQueue.addBulk as jest.Mock).mock.calls[0];
      expect(jobs[0].data).toEqual({ pendingItemId: 'item-1', batchId: 'batch-1' });
    });

    it('uses item ID for jobId deduplication: resolve-import-item-{itemId}', async () => {
      const items = [
        makePendingItem('item-abc', 'batch-1'),
        makePendingItem('item-xyz', 'batch-1'),
      ];
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue(items);

      await pipeline.execute({ batchId: 'batch-1' });

      const [jobs] = (backfillQueue.addBulk as jest.Mock).mock.calls[0];
      expect(jobs[0].opts).toEqual({ jobId: 'resolve-import-item-item-abc', delay: 0 });
      expect(jobs[1].opts).toEqual({ jobId: 'resolve-import-item-item-xyz', delay: 350 });
    });

    it('single pending item creates exactly one job', async () => {
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue([
        makePendingItem('item-1', 'batch-1'),
      ]);

      await pipeline.execute({ batchId: 'batch-1' });

      const [jobs] = (backfillQueue.addBulk as jest.Mock).mock.calls[0];
      expect(jobs).toHaveLength(1);
    });
  });

  describe('job structure completeness', () => {
    it('each job has name, data, and opts fields', async () => {
      const items = [makePendingItem('item-1', 'batch-1')];
      pendingRepo.findPendingByBatchAndStatus.mockResolvedValue(items);

      await pipeline.execute({ batchId: 'batch-1' });

      const [jobs] = (backfillQueue.addBulk as jest.Mock).mock.calls[0];
      const job = jobs[0];
      expect(job).toHaveProperty('name');
      expect(job).toHaveProperty('data');
      expect(job).toHaveProperty('opts');
    });
  });
});
