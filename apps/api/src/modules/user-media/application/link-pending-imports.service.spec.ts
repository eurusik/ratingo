import { type SavedItemsService } from '../../user-actions/application/saved-items.service';
import {
  IMPORT_BATCH_STATUS,
  IMPORT_PENDING_FAILURE,
  IMPORT_PENDING_STATUS,
  LINK_PENDING_IMPORTS_STALE_LINKING_MS,
} from '../domain/constants/import-pending.constants';
import { type ImportBatch } from '../domain/entities/import-batch';
import { type ImportPendingItem } from '../domain/entities/import-pending-item';
import { type IImportPendingRepository } from '../domain/repositories/import-pending.repository.interface';
import { type IUserMediaStateRepository } from '../domain/repositories/user-media-state.repository.interface';

import { LinkPendingImportsService } from './link-pending-imports.service';

const NOW = new Date('2026-10-29T12:00:00.000Z');

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

describe('LinkPendingImportsService', () => {
  let pendingRepo: jest.Mocked<IImportPendingRepository>;
  let userMediaRepo: jest.Mocked<Pick<IUserMediaStateRepository, 'bulkImport'>>;
  let savedItemsService: jest.Mocked<Pick<SavedItemsService, 'saveItem'>>;
  let service: LinkPendingImportsService;

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
      findLinkableWithReadyMedia: jest.fn(),
      claimForLinking: jest.fn().mockResolvedValue(true),
      failIngestingUpdatedBefore: jest.fn().mockResolvedValue([]),
      updateItemStatus: jest.fn().mockResolvedValue(undefined),
      updateItemStatusIfNotCancelled: jest.fn(),
      transitionItemStatus: jest.fn().mockResolvedValue(true),
      cancelBatch: jest.fn(),
      updateBatchCountersAtomic: jest.fn().mockResolvedValue({ id: 'batch-1' }),
    };

    userMediaRepo = {
      // Mimics a fresh insert: every planned item ends up planned
      bulkImport: jest.fn().mockImplementation(async (_userId: string, items: any[]) => ({
        imported: items.length,
        skipped: 0,
        plannedMediaItemIds: items.filter((i) => i.state === 'planned').map((i) => i.mediaItemId),
      })),
    };

    savedItemsService = {
      saveItem: jest.fn().mockResolvedValue({}),
    };

    service = new LinkPendingImportsService(
      pendingRepo as any,
      userMediaRepo as any,
      savedItemsService as any,
      { now: () => NOW },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('no pending items', () => {
    it('returns 0 without touching anything when no pending items await this tmdbId', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([]);

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.findBatchById).not.toHaveBeenCalled();
      expect(userMediaRepo.bulkImport).not.toHaveBeenCalled();
      expect(pendingRepo.transitionItemStatus).not.toHaveBeenCalled();
    });

    it('queries the items still INGESTING for this media', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([]);

      await service.linkReadyMedia({ tmdbId: 1399, type: 'show', mediaItemId: 'media-uuid-2' });

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

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

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

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-1',
        IMPORT_PENDING_STATUS.LINKING,
        {
          status: IMPORT_PENDING_STATUS.DONE,
          mediaItemId: 'media-uuid-1',
        },
      );
    });

    it('updates batch counters after linking', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
    });

    it('passes null rating when item has no rating', async () => {
      const item = makePendingItem({ rating: null });
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

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

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      // findBatchById called only once despite 3 items
      expect(pendingRepo.findBatchById).toHaveBeenCalledTimes(1);
      expect(pendingRepo.findBatchById).toHaveBeenCalledWith('batch-1');
    });

    it('retries the batch lookup for the next item after a failed lookup', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([
        makePendingItem({ id: 'item-1' }),
        makePendingItem({ id: 'item-2' }),
      ]);
      pendingRepo.findBatchById
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValueOnce(makeBatch());

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.findBatchById).toHaveBeenCalledTimes(2);
      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-2',
        IMPORT_PENDING_STATUS.LINKING,
        { status: IMPORT_PENDING_STATUS.DONE, mediaItemId: 'media-uuid-1' },
      );
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

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

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

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

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

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelled batch', () => {
    it('skips linking and counter update when batch is cancelled', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(
        makeBatch({ status: IMPORT_BATCH_STATUS.CANCELLED }),
      );

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(userMediaRepo.bulkImport).not.toHaveBeenCalled();
      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledTimes(1);
      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        item.id,
        IMPORT_PENDING_STATUS.INGESTING,
        {
          status: IMPORT_PENDING_STATUS.CANCELLED,
        },
      );
      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
    });
  });

  describe('batch not found', () => {
    it('logs warning and skips item when batch does not exist', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(null);

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(userMediaRepo.bulkImport).not.toHaveBeenCalled();
      expect(pendingRepo.transitionItemStatus).not.toHaveBeenCalled();
    });

    it('does not update batch counters when batch is not found', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(null);

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
    });
  });

  describe('item linking failure', () => {
    it('marks item FAILED with LINK_FAILED when bulkImport throws', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      userMediaRepo.bulkImport.mockRejectedValue(new Error('DB connection error'));

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-1',
        IMPORT_PENDING_STATUS.LINKING,
        {
          status: IMPORT_PENDING_STATUS.FAILED,
          failureReason: IMPORT_PENDING_FAILURE.LINK_FAILED,
        },
      );
    });

    it('continues processing other items when one fails', async () => {
      const items = [makePendingItem({ id: 'item-1' }), makePendingItem({ id: 'item-2' })];
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue(items);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      userMediaRepo.bulkImport
        .mockRejectedValueOnce(new Error('First item fails'))
        .mockResolvedValueOnce({ imported: 1, skipped: 0, plannedMediaItemIds: [] });

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      // Second item processed successfully
      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-2',
        IMPORT_PENDING_STATUS.LINKING,
        {
          status: IMPORT_PENDING_STATUS.DONE,
          mediaItemId: 'media-uuid-1',
        },
      );
    });

    it('still updates batch counters even when item linking fails', async () => {
      const item = makePendingItem();
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      userMediaRepo.bulkImport.mockRejectedValue(new Error('DB error'));

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      // affectedBatchIds still gets the batchId from the failed item
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
    });
  });

  describe('planned items saved to for_later', () => {
    it('calls saveItem with for_later and import context when item state is planned', async () => {
      const item = makePendingItem({ state: 'planned', rating: null });
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch({ userId: 'user-42' }));

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(savedItemsService.saveItem).toHaveBeenCalledWith({
        userId: 'user-42',
        mediaItemId: 'media-uuid-1',
        list: 'for_later',
        context: 'import',
      });
    });

    it('does not call saveItem when the row was skipped because a state already exists', async () => {
      const item = makePendingItem({ state: 'planned', rating: null });
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      // ON CONFLICT DO NOTHING: user already has (e.g.) a completed state for this media
      userMediaRepo.bulkImport.mockResolvedValueOnce({
        imported: 0,
        skipped: 1,
        plannedMediaItemIds: [],
      });

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(savedItemsService.saveItem).not.toHaveBeenCalled();
      // The pending item itself is still linked and marked DONE
      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-1',
        IMPORT_PENDING_STATUS.LINKING,
        {
          status: IMPORT_PENDING_STATUS.DONE,
          mediaItemId: 'media-uuid-1',
        },
      );
    });

    it('does not call saveItem when item state is not planned', async () => {
      const item = makePendingItem({ state: 'completed', rating: 80 });
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(savedItemsService.saveItem).not.toHaveBeenCalled();
    });

    it('marks item DONE when saveItem throws (saveItem is non-critical)', async () => {
      const item = makePendingItem({ state: 'planned' });
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([item]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      savedItemsService.saveItem.mockRejectedValue(new Error('saved_items error'));

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      // saveItem failure is isolated — user_media_state was written, so item is still DONE
      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-1',
        IMPORT_PENDING_STATUS.LINKING,
        {
          status: IMPORT_PENDING_STATUS.DONE,
          mediaItemId: 'media-uuid-1',
        },
      );
    });
  });

  describe('conditional INGESTING transition', () => {
    it('returns the number of items it moved to DONE', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([
        makePendingItem({ id: 'item-1' }),
        makePendingItem({ id: 'item-2' }),
      ]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      const linked = await service.linkReadyMedia({
        tmdbId: 550,
        type: 'movie',
        mediaItemId: 'media-uuid-1',
      });

      expect(linked).toBe(2);
    });

    it('does not count or refresh counters when a concurrent linker already moved the item', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([makePendingItem()]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      pendingRepo.transitionItemStatus.mockResolvedValue(false);

      const linked = await service.linkReadyMedia({
        tmdbId: 550,
        type: 'movie',
        mediaItemId: 'media-uuid-1',
      });

      expect(linked).toBe(0);
      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
    });

    it('does not mark FAILED over an item another writer already moved on', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([makePendingItem()]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      userMediaRepo.bulkImport.mockRejectedValue(new Error('DB error'));
      pendingRepo.transitionItemStatus.mockResolvedValue(false);

      await service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-1',
        IMPORT_PENDING_STATUS.LINKING,
        { status: IMPORT_PENDING_STATUS.FAILED, failureReason: IMPORT_PENDING_FAILURE.LINK_FAILED },
      );
      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
    });

    it('is idempotent: of two linkers racing on the same item only the claimant writes', async () => {
      const item = makePendingItem({ state: 'planned', rating: null });
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
      pendingRepo.claimForLinking.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const [first, second] = await Promise.all([
        service.linkItems([{ item, mediaItemId: 'media-uuid-1' }]),
        service.linkItems([{ item, mediaItemId: 'media-uuid-1' }]),
      ]);

      expect(first + second).toBe(1);
      expect(userMediaRepo.bulkImport).toHaveBeenCalledTimes(1);
      expect(savedItemsService.saveItem).toHaveBeenCalledTimes(1);
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledTimes(1);
    });
  });

  describe('claim before writing user state', () => {
    beforeEach(() => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([makePendingItem()]);
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());
    });

    const link = () =>
      service.linkReadyMedia({ tmdbId: 550, type: 'movie', mediaItemId: 'media-uuid-1' });

    it('claims INGESTING (or stale LINKING) items with the stale-linking cutoff from the clock', async () => {
      await link();

      expect(pendingRepo.claimForLinking).toHaveBeenCalledWith(
        'item-1',
        new Date(NOW.getTime() - LINK_PENDING_IMPORTS_STALE_LINKING_MS),
      );
      expect(pendingRepo.claimForLinking.mock.invocationCallOrder[0]).toBeLessThan(
        userMediaRepo.bulkImport.mock.invocationCallOrder[0],
      );
    });

    it('writes nothing for the user when the batch was cancelled before the claim', async () => {
      pendingRepo.claimForLinking.mockResolvedValue(false);

      await expect(link()).resolves.toBe(0);

      expect(userMediaRepo.bulkImport).not.toHaveBeenCalled();
      expect(savedItemsService.saveItem).not.toHaveBeenCalled();
      expect(pendingRepo.transitionItemStatus).not.toHaveBeenCalled();
    });

    it('leaves the item for the sweeper instead of failing it when the claim errors', async () => {
      pendingRepo.claimForLinking.mockRejectedValue(new Error('connection reset'));

      await expect(link()).resolves.toBe(0);

      expect(userMediaRepo.bulkImport).not.toHaveBeenCalled();
      expect(pendingRepo.transitionItemStatus).not.toHaveBeenCalled();
      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
    });

    it('cancels a stale LINKING item of a cancelled batch from its current status', async () => {
      pendingRepo.findItemsByResolvedTmdb.mockResolvedValue([
        makePendingItem({ status: IMPORT_PENDING_STATUS.LINKING }),
      ]);
      pendingRepo.findBatchById.mockResolvedValue(
        makeBatch({ status: IMPORT_BATCH_STATUS.CANCELLED }),
      );

      await link();

      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-1',
        IMPORT_PENDING_STATUS.LINKING,
        { status: IMPORT_PENDING_STATUS.CANCELLED },
      );
      expect(pendingRepo.claimForLinking).not.toHaveBeenCalled();
    });
  });

  describe('failTimedOutIngests', () => {
    const before = new Date('2026-10-28T12:00:00.000Z');

    it('refreshes counters once per affected batch and returns how many items timed out', async () => {
      pendingRepo.failIngestingUpdatedBefore.mockResolvedValue(['batch-1', 'batch-1', 'batch-2']);

      await expect(service.failTimedOutIngests(before, 200)).resolves.toBe(3);

      expect(pendingRepo.failIngestingUpdatedBefore).toHaveBeenCalledWith(before, 200);
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledTimes(2);
    });

    it('does nothing more when no ingest timed out', async () => {
      await expect(service.failTimedOutIngests(before, 200)).resolves.toBe(0);

      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
    });
  });

  describe('linkItems', () => {
    it('links each item to its own media item', async () => {
      pendingRepo.findBatchById.mockResolvedValue(makeBatch());

      await service.linkItems([
        { item: makePendingItem({ id: 'item-1' }), mediaItemId: 'media-a' },
        { item: makePendingItem({ id: 'item-2' }), mediaItemId: 'media-b' },
      ]);

      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-1',
        IMPORT_PENDING_STATUS.LINKING,
        { status: IMPORT_PENDING_STATUS.DONE, mediaItemId: 'media-a' },
      );
      expect(pendingRepo.transitionItemStatus).toHaveBeenCalledWith(
        'item-2',
        IMPORT_PENDING_STATUS.LINKING,
        { status: IMPORT_PENDING_STATUS.DONE, mediaItemId: 'media-b' },
      );
      expect(pendingRepo.findItemsByResolvedTmdb).not.toHaveBeenCalled();
    });

    it('returns 0 for an empty list', async () => {
      await expect(service.linkItems([])).resolves.toBe(0);
      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
    });
  });
});
