import { type SavedItemsService } from '../../user-actions/application/saved-items.service';
import { type IMediaLookupPort } from '../domain/ports/media-lookup.port';
import { type IUserMediaStateRepository } from '../domain/repositories/user-media-state.repository.interface';

import { ImportMediaService } from './import-media.service';
import { ImportPendingService } from './import-pending.service';

describe('ImportMediaService', () => {
  let mediaLookup: jest.Mocked<IMediaLookupPort>;
  let repo: jest.Mocked<Pick<IUserMediaStateRepository, 'bulkImport'>>;
  let importPendingService: jest.Mocked<Pick<ImportPendingService, 'createPendingBatches'>>;
  let savedItemsService: jest.Mocked<Pick<SavedItemsService, 'saveItem'>>;
  let service: ImportMediaService;

  beforeEach(() => {
    mediaLookup = {
      findManyByImdbIds: jest.fn(),
      findManyByTmdbIds: jest.fn(),
    };

    repo = {
      bulkImport: jest.fn(),
    };

    importPendingService = {
      createPendingBatches: jest.fn().mockResolvedValue([{ id: 'batch-1', totalItems: 0 }]),
    };

    savedItemsService = {
      saveItem: jest.fn().mockResolvedValue({}),
    };

    service = new ImportMediaService(
      mediaLookup as any,
      repo as any,
      importPendingService as any,
      savedItemsService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('all items matched by IMDB ID', () => {
    it('imports all items and reports correct counts', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
        { id: 'media-2', imdbId: 'tt0000002', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 2, skipped: 0 });

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0000001', state: 'completed', rating: 80, title: 'Film A' },
          { imdbId: 'tt0000002', state: 'planned', rating: null, title: 'Film B' },
        ],
        overwriteExisting: false,
      });

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.notFound).toBe(0);
      expect(repo.bulkImport).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({ mediaItemId: 'media-1', state: 'completed', rating: 80 }),
          expect.objectContaining({ mediaItemId: 'media-2', state: 'planned', rating: null }),
        ]),
        false,
      );
    });
  });

  describe('all items unmatched', () => {
    it('reports all as notFound and does not call bulkImport', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt9999999', state: 'completed', title: 'Unknown Film' },
          { imdbId: 'tt8888888', state: 'planned', title: 'Another Unknown' },
        ],
        overwriteExisting: false,
      });

      expect(result.notFound).toBe(2);
      expect(result.imported).toBe(0);
      expect(result.details.notFound).toHaveLength(2);
      expect(repo.bulkImport).not.toHaveBeenCalled();
    });
  });

  describe('mix of matched and unmatched', () => {
    it('reports correct split across imported and notFound', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 0 });

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0000001', state: 'completed', title: 'Found Film' },
          { imdbId: 'tt9999999', state: 'planned', title: 'Missing Film' },
        ],
        overwriteExisting: false,
      });

      expect(result.imported).toBe(1);
      expect(result.notFound).toBe(1);
    });
  });

  describe('TMDB fallback', () => {
    it('uses TMDB ID when IMDB ID is absent', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([
        { id: 'media-5', tmdbId: 550, type: 'movie' },
      ]);
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 0 });

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [{ tmdbId: 550, state: 'completed', title: 'Fight Club' }],
        overwriteExisting: false,
      });

      expect(result.imported).toBe(1);
      expect(result.notFound).toBe(0);
      expect(repo.bulkImport).toHaveBeenCalledWith(
        'user-1',
        [expect.objectContaining({ mediaItemId: 'media-5' })],
        false,
      );
    });
  });

  describe('overwrite: false — existing items skipped by DB', () => {
    it('reports repo-level skipped count correctly', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
        { id: 'media-2', imdbId: 'tt0000002', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      // DB skips 1 because it already exists
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 1 });

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0000001', state: 'completed', rating: 80 },
          { imdbId: 'tt0000002', state: 'planned', rating: null },
        ],
        overwriteExisting: false,
      });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(repo.bulkImport).toHaveBeenCalledWith(expect.any(String), expect.any(Array), false);
    });
  });

  describe('overwrite: true', () => {
    it('passes overwrite flag to repo', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 0 });

      await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [{ imdbId: 'tt0000001', state: 'completed', rating: 90 }],
        overwriteExisting: true,
      });

      expect(repo.bulkImport).toHaveBeenCalledWith(expect.any(String), expect.any(Array), true);
    });
  });

  describe('duplicate IMDB IDs in input', () => {
    it('deduplicates entries — last occurrence wins', async () => {
      // Both entries have the same IMDB ID; last one (rating: 90, completed) wins
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 0 });

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0000001', state: 'planned', rating: null, title: 'First occurrence' },
          { imdbId: 'tt0000001', state: 'completed', rating: 90, title: 'Duplicate — last wins' },
        ],
        overwriteExisting: false,
      });

      expect(mediaLookup.findManyByImdbIds).toHaveBeenCalledWith(['tt0000001']);

      expect(repo.bulkImport).toHaveBeenCalledWith(
        'user-1',
        [expect.objectContaining({ mediaItemId: 'media-1', state: 'completed', rating: 90 })],
        false,
      );
      expect(result.imported).toBe(1);
      expect(result.notFound).toBe(0);
    });
  });

  describe('items with no identifiers', () => {
    it('reports items with neither imdbId nor tmdbId as notFound', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 0, skipped: 0 });

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [{ state: 'completed', title: 'No IDs Film' }],
        overwriteExisting: false,
      });

      expect(result.notFound).toBe(1);
      expect(result.details.notFound[0].title).toBe('No IDs Film');
    });
  });

  describe('pending batch creation', () => {
    it('calls createPendingBatches and sets pendingBatch in result when not-found items have identifiers', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      importPendingService.createPendingBatches.mockResolvedValue([
        { id: 'batch-42', totalItems: 2 },
      ] as any);

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt9999999', state: 'completed', title: 'Unknown Film A' },
          { tmdbId: 99999, state: 'planned', title: 'Unknown Film B' },
        ],
        overwriteExisting: false,
      });

      expect(importPendingService.createPendingBatches).toHaveBeenCalledWith(
        'user-1',
        'kinobaza',
        expect.arrayContaining([
          expect.objectContaining({ imdbId: 'tt9999999' }),
          expect.objectContaining({ tmdbId: 99999 }),
        ]),
      );
      expect(result.pendingBatch).toEqual({ batchId: 'batch-42', totalItems: 2 });
    });

    it('does NOT call createPendingBatches when not-found items have no identifiers', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [{ state: 'completed', title: 'No IDs At All' }],
        overwriteExisting: false,
      });

      expect(importPendingService.createPendingBatches).not.toHaveBeenCalled();
      expect(result.pendingBatch).toBeUndefined();
    });

    it('import succeeds and pendingBatch is undefined when createPendingBatches throws', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 0 });
      // Second item is not found and has an identifier — triggers createPendingBatches
      importPendingService.createPendingBatches.mockRejectedValue(new Error('DB is down'));

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0000001', state: 'completed', title: 'Found Film' },
          { imdbId: 'tt9999999', state: 'planned', title: 'Not Found Film' },
        ],
        overwriteExisting: false,
      });

      // Core import should still succeed
      expect(result.imported).toBe(1);
      expect(result.notFound).toBe(1);
      // pendingBatch should be absent — error was swallowed
      expect(result.pendingBatch).toBeUndefined();
    });

    it('multi-batch aggregation — pendingBatch.totalItems is sum of all batch totalItems', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      importPendingService.createPendingBatches.mockResolvedValue([
        { id: 'batch-A', totalItems: 50 },
        { id: 'batch-B', totalItems: 30 },
      ] as any);

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt1111111', state: 'completed', title: 'Film 1' },
          { imdbId: 'tt2222222', state: 'planned', title: 'Film 2' },
        ],
        overwriteExisting: false,
      });

      // totalItems must be the sum of both batches: 50 + 30 = 80
      expect(result.pendingBatch?.totalItems).toBe(80);
    });

    it('multi-batch aggregation — pendingBatch.batchId uses the first batch id', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      importPendingService.createPendingBatches.mockResolvedValue([
        { id: 'first-batch', totalItems: 10 },
        { id: 'second-batch', totalItems: 5 },
      ] as any);

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [{ imdbId: 'tt3333333', state: 'completed', title: 'Film 3' }],
        overwriteExisting: false,
      });

      // batchId must reference the first batch, not the second
      expect(result.pendingBatch?.batchId).toBe('first-batch');
    });
  });

  describe('planned items saved to for_later', () => {
    it('calls saveItem for each matched planned item', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
        { id: 'media-2', imdbId: 'tt0000002', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 2, skipped: 0 });

      await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0000001', state: 'completed', rating: 80, title: 'Watched Film' },
          { imdbId: 'tt0000002', state: 'planned', rating: null, title: 'Want to Watch' },
        ],
        overwriteExisting: false,
      });

      // Only the planned item should be saved to for_later
      expect(savedItemsService.saveItem).toHaveBeenCalledTimes(1);
      expect(savedItemsService.saveItem).toHaveBeenCalledWith({
        userId: 'user-1',
        mediaItemId: 'media-2',
        list: 'for_later',
        context: 'import',
      });
    });

    it('does not call saveItem when no matched items are planned', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 0 });

      await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [{ imdbId: 'tt0000001', state: 'completed', rating: 90, title: 'Already Watched' }],
        overwriteExisting: false,
      });

      expect(savedItemsService.saveItem).not.toHaveBeenCalled();
    });

    it('import succeeds even when saveItem throws', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 1, skipped: 0 });
      savedItemsService.saveItem.mockRejectedValue(new Error('saved_items DB error'));

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [{ imdbId: 'tt0000001', state: 'planned', title: 'Watchlist Film' }],
        overwriteExisting: false,
      });

      // Core import should still succeed
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should process all 51 planned items across two saveItem chunks (50 + 1)', async () => {
      const items = Array.from({ length: 51 }, (_, i) => ({
        imdbId: `tt${String(i).padStart(7, '0')}`,
        state: 'planned' as const,
        title: `Movie ${i}`,
        rating: null,
      }));

      mediaLookup.findManyByImdbIds.mockResolvedValue(
        items.map((item, i) => ({ id: `media-${i}`, imdbId: item.imdbId, type: 'movie' })),
      );
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 51, skipped: 0 });

      await service.import({
        userId: 'user-1',
        source: 'imdb',
        items,
        overwriteExisting: false,
      });

      // All 51 planned items must have had saveItem called
      expect(savedItemsService.saveItem).toHaveBeenCalledTimes(51);
    });

    it('continues calling saveItem for subsequent planned items when one saveItem rejects', async () => {
      mediaLookup.findManyByImdbIds.mockResolvedValue([
        { id: 'media-1', imdbId: 'tt0000001', type: 'movie' },
        { id: 'media-2', imdbId: 'tt0000002', type: 'movie' },
        { id: 'media-3', imdbId: 'tt0000003', type: 'movie' },
      ]);
      mediaLookup.findManyByTmdbIds.mockResolvedValue([]);
      repo.bulkImport.mockResolvedValue({ imported: 3, skipped: 0 });
      // 2nd saveItem call rejects; 1st and 3rd succeed
      savedItemsService.saveItem
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error('saved_items DB error'))
        .mockResolvedValueOnce({} as any);

      const result = await service.import({
        userId: 'user-1',
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0000001', state: 'planned', title: 'Planned 1' },
          { imdbId: 'tt0000002', state: 'planned', title: 'Planned 2 — will fail' },
          { imdbId: 'tt0000003', state: 'planned', title: 'Planned 3' },
        ],
        overwriteExisting: false,
      });

      // All 3 saveItem calls were attempted despite the 2nd failing
      expect(savedItemsService.saveItem).toHaveBeenCalledTimes(3);
      // Core import is unaffected
      expect(result.imported).toBe(3);
      expect(result.skipped).toBe(0);
    });
  });
});
