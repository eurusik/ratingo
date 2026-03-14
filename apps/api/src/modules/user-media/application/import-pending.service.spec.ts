import { type IImportPendingRepository } from '../domain/repositories/import-pending.repository.interface';
import {
  MAX_PENDING_ITEMS_PER_BATCH,
  USER_BATCHES_LIMIT,
} from '../domain/constants/import-pending.constants';
import { type ImportBatch } from '../domain/entities/import-batch';
import { IngestionJob } from '../../ingestion/ingestion.constants';

import { ImportPendingService } from './import-pending.service';

const makeBatch = (overrides: Partial<ImportBatch> = {}): ImportBatch => ({
  id: 'batch-1',
  userId: 'user-1',
  source: 'kinobaza',
  totalItems: 2,
  completedCount: 0,
  failedCount: 0,
  status: 'processing',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

describe('ImportPendingService', () => {
  let pendingRepo: jest.Mocked<IImportPendingRepository>;
  let backfillQueue: { add: jest.Mock };
  let service: ImportPendingService;

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

    backfillQueue = { add: jest.fn().mockResolvedValue(undefined) };

    service = new ImportPendingService(pendingRepo as any, backfillQueue as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPendingBatch', () => {
    it('creates batch via repo and queues the dispatcher job', async () => {
      const batch = makeBatch();
      pendingRepo.createBatchWithItems.mockResolvedValue(batch);

      const items = [
        { imdbId: 'tt0000001', state: 'completed' as const, title: 'Film A', rating: 80 },
        { imdbId: 'tt0000002', state: 'planned' as const, title: 'Film B', rating: null },
      ];

      const result = await service.createPendingBatch('user-1', 'kinobaza', items);

      expect(pendingRepo.createBatchWithItems).toHaveBeenCalledWith(
        { userId: 'user-1', source: 'kinobaza', totalItems: 2 },
        [
          { imdbId: 'tt0000001', tmdbId: null, title: 'Film A', rating: 80, state: 'completed' },
          { imdbId: 'tt0000002', tmdbId: null, title: 'Film B', rating: null, state: 'planned' },
        ],
      );

      expect(backfillQueue.add).toHaveBeenCalledWith(
        IngestionJob.RESOLVE_IMPORT_DISPATCHER,
        { batchId: batch.id },
        expect.objectContaining({ jobId: `resolve-import-${batch.id}` }),
      );

      expect(result).toBe(batch);
    });

    it('truncates items exceeding MAX_PENDING_ITEMS_PER_BATCH and emits a warning', async () => {
      const batch = makeBatch({ totalItems: MAX_PENDING_ITEMS_PER_BATCH });
      pendingRepo.createBatchWithItems.mockResolvedValue(batch);

      const overLimit = MAX_PENDING_ITEMS_PER_BATCH + 5;
      const items = Array.from({ length: overLimit }, (_, i) => ({
        imdbId: `tt${String(i).padStart(7, '0')}`,
        state: 'completed' as const,
        title: `Film ${i}`,
        rating: null,
      }));

      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await service.createPendingBatch('user-1', 'kinobaza', items);

      const [batchInput] = pendingRepo.createBatchWithItems.mock.calls[0];
      expect(batchInput.totalItems).toBe(MAX_PENDING_ITEMS_PER_BATCH);

      const [, itemsArg] = pendingRepo.createBatchWithItems.mock.calls[0];
      expect(itemsArg).toHaveLength(MAX_PENDING_ITEMS_PER_BATCH);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${MAX_PENDING_ITEMS_PER_BATCH} items`),
      );

      warnSpy.mockRestore();
    });

    it('uses jobId format resolve-import-{batchId}', async () => {
      const batch = makeBatch({ id: 'abc-123' });
      pendingRepo.createBatchWithItems.mockResolvedValue(batch);

      await service.createPendingBatch('user-1', 'kinobaza', [
        { imdbId: 'tt0000001', state: 'completed' as const },
      ]);

      expect(backfillQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ jobId: 'resolve-import-abc-123' }),
      );
    });
  });

  describe('getUserBatches', () => {
    it('delegates to repo with USER_BATCHES_LIMIT', async () => {
      const batches = [makeBatch({ id: 'b1' }), makeBatch({ id: 'b2' })];
      pendingRepo.findActiveBatchesByUser.mockResolvedValue(batches);

      const result = await service.getUserBatches('user-1');

      expect(pendingRepo.findActiveBatchesByUser).toHaveBeenCalledWith(
        'user-1',
        USER_BATCHES_LIMIT,
      );
      expect(result).toBe(batches);
    });

    it('returns empty array when repo returns no batches', async () => {
      pendingRepo.findActiveBatchesByUser.mockResolvedValue([]);

      const result = await service.getUserBatches('user-1');

      expect(result).toEqual([]);
    });
  });
});
