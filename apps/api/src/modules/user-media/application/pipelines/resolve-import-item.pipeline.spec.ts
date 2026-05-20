import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Queue } from 'bullmq';

import { IngestionJob } from '../../../ingestion/ingestion.constants';
import {
  IMPORT_PENDING_FAILURE,
  IMPORT_PENDING_STATUS,
} from '../../domain/constants/import-pending.constants';
import { type ImportPendingItem } from '../../domain/entities/import-pending-item';
import { type IMediaLookupPort } from '../../domain/ports/media-lookup.port';
import { type ITmdbResolverPort } from '../../domain/ports/tmdb-resolver.port';
import { type IImportPendingRepository } from '../../domain/repositories/import-pending.repository.interface';

import { ResolveImportItemPipeline } from './resolve-import-item.pipeline';

function makePendingItem(overrides: Partial<ImportPendingItem> = {}): ImportPendingItem {
  return {
    id: 'item-1',
    batchId: 'batch-1',
    imdbId: null,
    tmdbId: null,
    resolvedTmdbId: null,
    mediaType: null,
    title: 'Test Movie',
    rating: 80,
    state: 'completed',
    status: IMPORT_PENDING_STATUS.PENDING,
    failureReason: null,
    mediaItemId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Mock BullMQ job that reports the given state. */
function makeJob(state: string = 'waiting') {
  return { id: 'job-1', getState: jest.fn().mockResolvedValue(state) };
}

describe('ResolveImportItemPipeline', () => {
  let pendingRepo: jest.Mocked<IImportPendingRepository>;
  let tmdbResolver: jest.Mocked<ITmdbResolverPort>;
  let ingestionQueue: jest.Mocked<Pick<Queue, 'add'>>;
  let mediaLookup: jest.Mocked<IMediaLookupPort>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emitAsync'>>;
  let pipeline: ResolveImportItemPipeline;

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
      updateItemStatusIfNotCancelled: jest.fn().mockResolvedValue(true),
      cancelBatch: jest.fn(),
      updateBatchCountersAtomic: jest.fn().mockResolvedValue({ id: 'batch-1' }),
    };

    tmdbResolver = {
      findByImdbId: jest.fn(),
      checkExists: jest.fn(),
    };

    ingestionQueue = {
      add: jest.fn().mockResolvedValue(makeJob()),
    };

    mediaLookup = {
      findManyByImdbIds: jest.fn().mockResolvedValue([]),
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
    };

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    };

    pipeline = new ResolveImportItemPipeline(
      pendingRepo as any,
      tmdbResolver as any,
      ingestionQueue as any,
      mediaLookup as any,
      eventEmitter as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('item not found in DB', () => {
    it('returns early without any updates when item does not exist', async () => {
      pendingRepo.findById.mockResolvedValue(null);

      await pipeline.execute({ pendingItemId: 'missing-item', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('idempotency guards', () => {
    it('reprocesses item stuck in RESOLVING status (transient error recovery)', async () => {
      // After a transient error the item is left in RESOLVING.
      // The next retry must pick it back up — RESOLVING is NOT a terminal state.
      const item = makePendingItem({
        status: IMPORT_PENDING_STATUS.RESOLVING,
        imdbId: null,
        tmdbId: null,
      });
      pendingRepo.findById.mockResolvedValue(item);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      // Pipeline should move it forward (here to RESOLVING again then FAILED since no IDs)
      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalled();
    });

    it('skips item already in DONE status', async () => {
      pendingRepo.findById.mockResolvedValue(
        makePendingItem({ status: IMPORT_PENDING_STATUS.DONE }),
      );

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatusIfNotCancelled).not.toHaveBeenCalled();
      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });

    it('skips item already in INGESTING status', async () => {
      pendingRepo.findById.mockResolvedValue(
        makePendingItem({ status: IMPORT_PENDING_STATUS.INGESTING }),
      );

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatusIfNotCancelled).not.toHaveBeenCalled();
      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });

    it('skips item already in CANCELLED status', async () => {
      pendingRepo.findById.mockResolvedValue(
        makePendingItem({ status: IMPORT_PENDING_STATUS.CANCELLED }),
      );

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatusIfNotCancelled).not.toHaveBeenCalled();
      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });

    it('returns early when item is cancelled between status check and resolving write (race condition)', async () => {
      const item = makePendingItem({ imdbId: 'tt0000001' });
      pendingRepo.findById.mockResolvedValue(item);
      // Simulate race: the conditional update returns false (item was cancelled concurrently)
      pendingRepo.updateItemStatusIfNotCancelled.mockResolvedValue(false);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.RESOLVING,
      });
      expect(tmdbResolver.findByImdbId).not.toHaveBeenCalled();
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('resolution via IMDB ID', () => {
    it('resolves movie via IMDB ID: PENDING→RESOLVING→INGESTING, queues SYNC_MOVIE', async () => {
      const item = makePendingItem({ imdbId: 'tt0000001' });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue({ tmdbId: 550, type: 'movie' });

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      // Conditional update: PENDING → RESOLVING (skips if cancelled)
      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.RESOLVING,
      });

      // Second update: RESOLVING → INGESTING with resolved IDs (skips if cancelled)
      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.INGESTING,
        resolvedTmdbId: 550,
        mediaType: 'movie',
      });

      // Queues SYNC_MOVIE with oneshot jobId
      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_MOVIE,
        { tmdbId: 550, type: 'movie' },
        { jobId: 'movie_550_oneshot' },
      );

      expect(tmdbResolver.findByImdbId).toHaveBeenCalledWith('tt0000001');
      expect(tmdbResolver.checkExists).not.toHaveBeenCalled();
    });

    it('resolves show via IMDB ID and queues SYNC_SHOW', async () => {
      const item = makePendingItem({ imdbId: 'tt1234567' });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue({ tmdbId: 1399, type: 'show' });

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_SHOW,
        { tmdbId: 1399, type: 'show' },
        { jobId: 'show_1399_oneshot' },
      );
    });
  });

  describe('resolution via TMDB ID', () => {
    it('resolves movie via TMDB ID and queues SYNC_MOVIE', async () => {
      const item = makePendingItem({ tmdbId: 550 });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.checkExists.mockResolvedValueOnce(true); // movie check
      tmdbResolver.checkExists.mockResolvedValueOnce(false); // show check

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(tmdbResolver.checkExists).toHaveBeenCalledWith(550, 'movie');
      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_MOVIE,
        { tmdbId: 550, type: 'movie' },
        { jobId: 'movie_550_oneshot' },
      );
    });

    it('resolves show via TMDB ID when movie check fails and queues SYNC_SHOW', async () => {
      const item = makePendingItem({ tmdbId: 1399 });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.checkExists.mockResolvedValueOnce(false); // movie check
      tmdbResolver.checkExists.mockResolvedValueOnce(true); // show check

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_SHOW,
        { tmdbId: 1399, type: 'show' },
        { jobId: 'show_1399_oneshot' },
      );
    });

    it('runs movie and show checks in parallel', async () => {
      const item = makePendingItem({ tmdbId: 42 });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.checkExists.mockResolvedValue(true);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(tmdbResolver.checkExists).toHaveBeenCalledTimes(2);
      expect(tmdbResolver.checkExists).toHaveBeenCalledWith(42, 'movie');
      expect(tmdbResolver.checkExists).toHaveBeenCalledWith(42, 'show');
    });
  });

  describe('IMDB ID takes precedence over TMDB ID', () => {
    it('uses IMDB ID resolver when both identifiers are present', async () => {
      const item = makePendingItem({ imdbId: 'tt0000001', tmdbId: 550 });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue({ tmdbId: 550, type: 'movie' });

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(tmdbResolver.findByImdbId).toHaveBeenCalledWith('tt0000001');
      expect(tmdbResolver.checkExists).not.toHaveBeenCalled();
    });
  });

  describe('TMDB not found', () => {
    it('marks item FAILED with TMDB_NOT_FOUND and updates batch counters', async () => {
      const item = makePendingItem({ imdbId: 'tt9999999' });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue(null);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.FAILED,
        failureReason: IMPORT_PENDING_FAILURE.TMDB_NOT_FOUND,
      });
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });

    it('marks FAILED when both TMDB movie and show checks return false', async () => {
      const item = makePendingItem({ tmdbId: 99999 });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.checkExists.mockResolvedValue(false);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.FAILED,
        failureReason: IMPORT_PENDING_FAILURE.TMDB_NOT_FOUND,
      });
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
    });

    it('marks FAILED when item has neither IMDB nor TMDB ID', async () => {
      const item = makePendingItem({ imdbId: null, tmdbId: null });
      pendingRepo.findById.mockResolvedValue(item);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.FAILED,
        failureReason: IMPORT_PENDING_FAILURE.TMDB_NOT_FOUND,
      });
      expect(pendingRepo.updateBatchCountersAtomic).toHaveBeenCalledWith('batch-1');
    });
  });

  describe('transient errors', () => {
    it('rethrows transient TMDB error and does NOT mark item as failed', async () => {
      const item = makePendingItem({ imdbId: 'tt0000001' });
      pendingRepo.findById.mockResolvedValue(item);
      const networkError = new Error('Network timeout');
      tmdbResolver.findByImdbId.mockRejectedValue(networkError);

      await expect(
        pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' }),
      ).rejects.toThrow('Network timeout');

      // Item was moved to RESOLVING (via conditional write) but never marked FAILED
      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledTimes(1);
      expect(pendingRepo.updateItemStatusIfNotCancelled).toHaveBeenCalledWith('item-1', {
        status: IMPORT_PENDING_STATUS.RESOLVING,
      });
      expect(pendingRepo.updateItemStatus).not.toHaveBeenCalled();
      expect(pendingRepo.updateBatchCountersAtomic).not.toHaveBeenCalled();
      expect(ingestionQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('fix 4.4 — synthetic media.synced for already-completed jobs', () => {
    it('emits synthetic media.synced when deduplicated job is already completed', async () => {
      const item = makePendingItem({ imdbId: 'tt0000001' });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue({ tmdbId: 550, type: 'movie' });

      // Job already completed (deduplicated by oneshot jobId)
      ingestionQueue.add = jest.fn().mockResolvedValue(makeJob('completed'));
      mediaLookup.findManyByTmdbIds = jest
        .fn()
        .mockResolvedValue([{ id: 'media-123', type: 'movie' }]);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(mediaLookup.findManyByTmdbIds).toHaveBeenCalledWith([550]);
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'media.synced',
        expect.objectContaining({ tmdbId: 550, type: 'movie', mediaItemId: 'media-123' }),
      );
    });

    it('does not emit synthetic event when job is still waiting', async () => {
      const item = makePendingItem({ imdbId: 'tt0000001' });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue({ tmdbId: 550, type: 'movie' });
      ingestionQueue.add = jest.fn().mockResolvedValue(makeJob('waiting'));

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(mediaLookup.findManyByTmdbIds).not.toHaveBeenCalled();
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe('jobId deduplication format', () => {
    it('uses oneshot jobId format: {type}_{tmdbId}_oneshot', async () => {
      const item = makePendingItem({ imdbId: 'tt0000001' });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue({ tmdbId: 550, type: 'movie' });

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(ingestionQueue.add).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {
        jobId: 'movie_550_oneshot',
      });
    });

    it('show jobId format: show_{tmdbId}_oneshot', async () => {
      const item = makePendingItem({ imdbId: 'tt1234567' });
      pendingRepo.findById.mockResolvedValue(item);
      tmdbResolver.findByImdbId.mockResolvedValue({ tmdbId: 1399, type: 'show' });

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(ingestionQueue.add).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {
        jobId: 'show_1399_oneshot',
      });
    });
  });

  describe('movie type precedence when both TMDB checks return true', () => {
    it('prefers movie over show when both exist for same TMDB ID', async () => {
      const item = makePendingItem({ tmdbId: 1 });
      pendingRepo.findById.mockResolvedValue(item);
      // Both movie and show return true (degenerate case)
      tmdbResolver.checkExists.mockResolvedValue(true);

      await pipeline.execute({ pendingItemId: 'item-1', batchId: 'batch-1' });

      expect(ingestionQueue.add).toHaveBeenCalledWith(
        IngestionJob.SYNC_MOVIE,
        { tmdbId: 1, type: 'movie' },
        expect.any(Object),
      );
    });
  });
});
