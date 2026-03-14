import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import {
  IMPORT_BATCH_STATUS,
  IMPORT_PENDING_STATUS,
} from '../domain/constants/import-pending.constants';

import { DrizzleImportPendingRepository } from './drizzle-import-pending.repository';

const makeBatchRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'batch-1',
  userId: 'user-1',
  source: 'kinobaza',
  totalItems: 2,
  completedCount: 0,
  failedCount: 0,
  status: IMPORT_BATCH_STATUS.PROCESSING,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const makeItemRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  batchId: 'batch-1',
  imdbId: 'tt0000001',
  tmdbId: null,
  resolvedTmdbId: null,
  mediaType: null,
  title: 'Film A',
  rating: 80,
  state: 'completed',
  status: IMPORT_PENDING_STATUS.PENDING,
  failureReason: null,
  mediaItemId: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

describe('DrizzleImportPendingRepository', () => {
  let repository: DrizzleImportPendingRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrizzleImportPendingRepository,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    repository = module.get<DrizzleImportPendingRepository>(DrizzleImportPendingRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBatchWithItems', () => {
    it('calls insert for batch and items within transaction', async () => {
      const batchRow = makeBatchRow();

      // The transaction callback receives a tx object; mock transaction to invoke callback immediately
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([batchRow]),
        };
        return cb(tx);
      });

      const result = await repository.createBatchWithItems(
        { userId: 'user-1', source: 'kinobaza', totalItems: 2 },
        [
          { imdbId: 'tt0000001', tmdbId: null, title: 'Film A', rating: 80, state: 'completed' },
          { imdbId: 'tt0000002', tmdbId: null, title: 'Film B', rating: null, state: 'planned' },
        ],
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('batch-1');
      expect(result.userId).toBe('user-1');
    });

    it('transaction inserts batch then items (two insert calls on tx)', async () => {
      const batchRow = makeBatchRow();
      const txInsertReturning = jest.fn().mockResolvedValue([batchRow]);
      const txInsertValues = jest.fn().mockReturnThis();
      const txInsertChain = { values: txInsertValues, returning: txInsertReturning };

      let insertCallCount = 0;
      const tx = {
        insert: jest.fn().mockImplementation(() => {
          insertCallCount++;
          return {
            values: jest.fn().mockReturnValue(
              // first call (batch): has .returning(); second call (items): no .returning()
              insertCallCount === 1 ? { returning: txInsertReturning } : { returning: undefined },
            ),
          };
        }),
      };

      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(tx));

      await repository.createBatchWithItems(
        { userId: 'user-1', source: 'kinobaza', totalItems: 1 },
        [{ imdbId: 'tt0000001', tmdbId: null, title: 'Film A', rating: null, state: 'completed' }],
      );

      // insert is called twice: once for batch, once for items
      expect(tx.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('findActiveBatchesByUser', () => {
    it('queries with userId filter and limit, returning mapped batches', async () => {
      const batchRow = makeBatchRow();
      mockDb.limit.mockResolvedValueOnce([batchRow]);

      const result = await repository.findActiveBatchesByUser('user-1', 5);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('batch-1');
      expect(result[0].userId).toBe('user-1');
    });

    it('returns empty array when no batches found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.findActiveBatchesByUser('user-1', 10);

      expect(result).toEqual([]);
    });
  });

  describe('updateItemStatus', () => {
    it('updates the correct item with new status and updatedAt', async () => {
      mockDb.where.mockResolvedValueOnce(undefined);

      await repository.updateItemStatus('item-1', {
        status: IMPORT_PENDING_STATUS.DONE,
        resolvedTmdbId: 550,
        mediaType: 'movie',
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: IMPORT_PENDING_STATUS.DONE,
          resolvedTmdbId: 550,
          mediaType: 'movie',
          updatedAt: expect.any(Date),
        }),
      );
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('includes failureReason when provided', async () => {
      mockDb.where.mockResolvedValueOnce(undefined);

      await repository.updateItemStatus('item-1', {
        status: IMPORT_PENDING_STATUS.FAILED,
        failureReason: 'tmdb_not_found',
      });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: IMPORT_PENDING_STATUS.FAILED,
          failureReason: 'tmdb_not_found',
        }),
      );
    });
  });

  describe('updateBatchCountersAtomic', () => {
    it('executes atomic SQL update with correct batch ID and returns mapped batch', async () => {
      const batchRow = makeBatchRow({
        completedCount: 3,
        failedCount: 1,
        status: IMPORT_BATCH_STATUS.COMPLETED,
      });
      mockDb.returning.mockResolvedValueOnce([batchRow]);

      const result = await repository.updateBatchCountersAtomic('batch-1');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
      expect(result.completedCount).toBe(3);
      expect(result.failedCount).toBe(1);
      expect(result.status).toBe(IMPORT_BATCH_STATUS.COMPLETED);
    });
  });

  describe('findItemsByResolvedTmdb', () => {
    it('filters by tmdbId, mediaType, and status and returns mapped items', async () => {
      const itemRow = makeItemRow({
        resolvedTmdbId: 550,
        mediaType: 'movie',
        status: IMPORT_PENDING_STATUS.LINKING,
      });
      mockDb.where.mockResolvedValueOnce([itemRow]);

      const result = await repository.findItemsByResolvedTmdb(
        550,
        'movie',
        IMPORT_PENDING_STATUS.LINKING,
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
      expect(result[0].resolvedTmdbId).toBe(550);
      expect(result[0].mediaType).toBe('movie');
    });

    it('returns empty array when no matching items found', async () => {
      mockDb.where.mockResolvedValueOnce([]);

      const result = await repository.findItemsByResolvedTmdb(
        9999,
        'show',
        IMPORT_PENDING_STATUS.LINKING,
      );

      expect(result).toEqual([]);
    });
  });
});
