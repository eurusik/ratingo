import {
  toImportBatch,
  toImportPendingItem,
  toPendingItemUpdateValues,
} from './import-pending.mapper';

describe('import-pending.mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00Z');
  const updatedAt = new Date('2026-01-02T00:00:00Z');

  it('maps a batch row to an ImportBatch', () => {
    const row = {
      id: 'b1',
      userId: 'u1',
      source: 'imdb',
      totalItems: 3,
      completedCount: 1,
      failedCount: 0,
      status: 'processing',
      createdAt,
      updatedAt,
    };

    expect(toImportBatch(row as Parameters<typeof toImportBatch>[0])).toEqual(row);
  });

  it('maps an item row to an ImportPendingItem', () => {
    const row = {
      id: 'i1',
      batchId: 'b1',
      imdbId: 'tt1',
      tmdbId: 10,
      resolvedTmdbId: 10,
      mediaType: 'movie',
      title: 'Title',
      rating: 8,
      state: 'completed',
      status: 'done',
      failureReason: null,
      mediaItemId: 'm1',
      createdAt,
      updatedAt,
    };

    expect(toImportPendingItem(row as Parameters<typeof toImportPendingItem>[0])).toEqual(row);
  });

  it('includes only the update fields that are defined', () => {
    const values = toPendingItemUpdateValues({
      status: 'done',
      mediaItemId: 'm1',
    } as Parameters<typeof toPendingItemUpdateValues>[0]);

    expect(values).toEqual({ status: 'done', mediaItemId: 'm1', updatedAt: expect.any(Date) });
  });
});
