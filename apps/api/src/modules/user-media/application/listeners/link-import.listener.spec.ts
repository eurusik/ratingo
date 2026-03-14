import { MediaSyncedEvent } from '../../../ingestion/public';
import {
  IMPORT_PENDING_FAILURE,
  IMPORT_PENDING_STATUS,
} from '../../domain/constants/import-pending.constants';
import { type ImportBatch } from '../../domain/entities/import-batch';
import { type ImportPendingItem } from '../../domain/entities/import-pending-item';
import { type IImportPendingRepository } from '../../domain/repositories/import-pending.repository.interface';
import { type IUserMediaStateRepository } from '../../domain/repositories/user-media-state.repository.interface';

import { LinkImportListener } from './link-import.listener';

function makeBatch(overrides: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: 'batch-1',
    userId: 'user-1',
    source: 'kinobaza',
    totalItems: 1,
    completedCount: 0,
    failedCount: 0,
    status: 'processing',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePendingItem(overrides: Partial<ImportPendingItem> = {}): ImportPendingItem {
  return {
    id: 'item-1',
    batchId: 'batch-1',
    imdbId: 'tt0000001',
    tmdbId: null,
    resolvedTmdbId: 550,
    mediaType: 'movie',
    title: 'Test Movie',
    rating: 80,
    state: 'completed',
    status: IMPORT_PENDING_STATUS.INGESTING,
    failureReason: null,
    mediaItemId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LinkImportListener', () => {
  let pendingRepo: jest.Mocked<IImportPendingRepository>;
  let userMediaRepo: jest.Mocked<Pick<IUserMediaStateRepository, 'bulkImport'>>;
  let listener: LinkImportListener;

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
      updateItemStatus: jest.fn().mockResolvedValue(undefined),
      updateBatchCountersAtomic: jest.fn().mockResolvedValue({ id: 'batch-1' }),
    };

    userMediaRepo = {
      bulkImport: jest.fn().mockResolvedValue({ imported: 1, skipped: 0 }),
    };

    listener = new LinkImportListener(pendingRepo as any, userMediaRepo as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('no pending items', () => {
    it('returns early when no pending items await this tmdbId', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([]);

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.findBatchById).not.toHaveBeenCalled();
      expect(userMediaRepo.bulkImport).not.toHaveBeenCalled();
      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
    });

    it('queries repo with correct arguments from the event', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([]);

      const event = new MediaSyncedEvent(1399, 'show', 'media-uuid-2');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.findItemsByResolvedTmdb).toHaveBeenCalledWith(
        1399,
        'show',
        IMPORT_PENDING_STATUS.INGESTING,
      );
    });
  });

  describe('single item linking', () => {
    it('creates user_media_state with correct userId, mediaItemId, state, and rating', async () => {
      const item = makePendingItem({ state: 'completed', rating: 80 });
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch({ userId: 'user-42' }));

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(userMediaRepo.bulkImport).toHaveBeenCalledWith(
        'user-42',
        [{ mediaItemId: 'media-uuid-1', state: 'completed', rating: 80 }],
        false,
      );
    });

    it('marks the item DONE with the resolved mediaItemId', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.updateItemStatus).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.DONE,
        mediaItemId: 'media-uuid-1',
      });
    });

    it('updates batch counters after linking', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
    });

    it('passes null rating when item has no rating', async () => {
      const item = makePendingItem({ rating: null });
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(userMediaRepo.bulkImport).toHaveBeenCalledWith(
        expect.any(String),
        [expect.objectContaining({ rating: null })],
        false,
      );
    });
  });

  describe('batch lookup caching', () => {
    it('only makes one DB call for multiple items from the same batch', async () => {
      const items = [
        makePendingItem({ id: 'item-1', batchId: 'batch-1' }),
        makePendingItem({ id: 'item-2', batchId: 'batch-1' }),
        makePendingItem({ id: 'item-3', batchId: 'batch-1' }),
      ];
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue(items);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch({ id: 'batch-1' }));

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      // findBatchById called only once despite 3 items
      expect(pendingRepo.findBatchById).toHaveBeenCalledTimes(1);
      expect(pendingRepo.findBatchById).toHaveBeenCalledWith('batch-1');
    });

    it('makes separate DB calls for items from different batches', async () => {
      const items = [
        makePendingItem({ id: 'item-1', batchId: 'batch-1' }),
        makePendingItem({ id: 'item-2', batchId: 'batch-2' }),
      ];
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue(items);
      pendingRepo.findBatchById
        .mockResolvedValueOnce(makeBatch({ id: 'batch-1', userId: 'user-1' }))
        .mockResolvedValueOnce(makeBatch({ id: 'batch-2', userId: 'user-2' }));

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.findBatchById).toHaveBeenCalledTimes(2);
    });
  });

  describe('batch counter update deduplication', () => {
    it('updates batch counters once per unique batchId, not once per item', async () => {
      const items = [
        makePendingItem({ id: 'item-1', batchId: 'batch-1' }),
        makePendingItem({ id: 'item-2', batchId: 'batch-1' }),
        makePendingItem({ id: 'item-3', batchId: 'batch-1' }),
      ];
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue(items);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch({ id: 'batch-1' }));

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      // Should be called exactly once for batch-1, not 3 times
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledTimes(1);
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
    });

    it('updates counters once per unique batch across multiple batches', async () => {
      const items = [
        makePendingItem({ id: 'item-1', batchId: 'batch-1' }),
        makePendingItem({ id: 'item-2', batchId: 'batch-2' }),
      ];
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue(items);
      pendingRepo.findBatchById
        .mockResolvedValueOnce(makeBatch({ id: 'batch-1' }))
        .mockResolvedValueOnce(makeBatch({ id: 'batch-2' }));

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledTimes(2);
    });
  });

  describe('batch not found', () => {
    it('logs warning and skips item when batch does not exist', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(null);

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      // Should not throw
      await expect(listener.handleMediaSynced(event)).resolves.not.toThrow();

      expect(userMediaRepo.bulkImport).not.toHaveBeenCalled();
      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
    });

    it('does not update batch counters when batch is not found', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(null);

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
    });
  });

  describe('item linking failure', () => {
    it('marks item FAILED with LINK_FAILED when bulkImport throws', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      userMediaRepo.bulkImport.mockRejectedValue(new Error('DB connection error'));

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      expect(pendingRepo.updateItemStatus).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.FAILED,
        failureReason: IMPORT_PENDING_FAILURE.LINK_FAILED,
      });
    });

    it('continues processing other items when one fails', async () => {
      const items = [makePendingItem({ id: 'item-1' }), makePendingItem({ id: 'item-2' })];
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue(items);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      userMediaRepo.bulkImport
        .mockRejectedValueOnce(new Error('First item fails'))
        .mockResolvedValueOnce({ imported: 1, skipped: 0 });

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      // Should not throw
      await expect(listener.handleMediaSynced(event)).resolves.not.toThrow();

      // Second item processed successfully
      expect(pendingRepo.updateItemStatus).toHaveBeenCalledWith('item-2', {
        status: IMPORT_PENDING_STATUS.DONE,
        mediaItemId: 'media-uuid-1',
      });
    });

    it('still updates batch counters even when item linking fails', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      userMediaRepo.bulkImport.mockRejectedValue(new Error('DB error'));

      const event = new MediaSyncedEvent(550, 'movie', 'media-uuid-1');
      await listener.handleMediaSynced(event);

      // affectedBatchIds still gets the batchId from the failed item
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
    });
  });
});
