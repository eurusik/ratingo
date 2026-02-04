import { MediaType } from '@/common/enums/media-type.enum';

import { filterValidTmdbIds, mapToMediaIdItem, toMediaIdItems } from './media-item-result.mapper';

describe('media-item-result.mapper', () => {
  describe('filterValidTmdbIds', () => {
    it('filters out rows with null tmdbId', () => {
      const rows = [
        { id: '1', tmdbId: 100, type: MediaType.MOVIE },
        { id: '2', tmdbId: null, type: MediaType.SHOW },
        { id: '3', tmdbId: 200, type: MediaType.MOVIE },
      ];

      const result = filterValidTmdbIds(rows);

      expect(result).toHaveLength(2);
      expect(result[0].tmdbId).toBe(100);
      expect(result[1].tmdbId).toBe(200);
    });

    it('returns empty array when all rows have null tmdbId', () => {
      const rows = [
        { id: '1', tmdbId: null, type: MediaType.MOVIE },
        { id: '2', tmdbId: null, type: MediaType.SHOW },
      ];

      const result = filterValidTmdbIds(rows);

      expect(result).toHaveLength(0);
    });

    it('returns all rows when none have null tmdbId', () => {
      const rows = [
        { id: '1', tmdbId: 100, type: MediaType.MOVIE },
        { id: '2', tmdbId: 200, type: MediaType.SHOW },
      ];

      const result = filterValidTmdbIds(rows);

      expect(result).toHaveLength(2);
    });

    it('preserves additional fields in rows', () => {
      const rows = [
        { id: '1', tmdbId: 100, type: MediaType.MOVIE, voteCount: 500, title: 'Test Movie' },
      ];

      const result = filterValidTmdbIds(rows);

      expect(result[0]).toEqual({
        id: '1',
        tmdbId: 100,
        type: MediaType.MOVIE,
        voteCount: 500,
        title: 'Test Movie',
      });
    });

    it('handles empty array', () => {
      const result = filterValidTmdbIds([]);

      expect(result).toHaveLength(0);
    });
  });

  describe('mapToMediaIdItem', () => {
    it('extracts only id, tmdbId, and type fields', () => {
      const row = {
        id: 'uuid-123',
        tmdbId: 12345,
        type: MediaType.MOVIE,
        voteCount: 1000,
        title: 'Extra Field',
      };

      const result = mapToMediaIdItem(row);

      expect(result).toEqual({
        id: 'uuid-123',
        tmdbId: 12345,
        type: MediaType.MOVIE,
      });
      expect(result).not.toHaveProperty('voteCount');
      expect(result).not.toHaveProperty('title');
    });

    it('works with MediaType.MOVIE', () => {
      const row = { id: '1', tmdbId: 100, type: MediaType.MOVIE };

      const result = mapToMediaIdItem(row);

      expect(result.type).toBe(MediaType.MOVIE);
    });

    it('works with MediaType.SHOW', () => {
      const row = { id: '1', tmdbId: 100, type: MediaType.SHOW };

      const result = mapToMediaIdItem(row);

      expect(result.type).toBe(MediaType.SHOW);
    });
  });

  describe('toMediaIdItems', () => {
    it('combines filter and map operations', () => {
      const rows = [
        { id: '1', tmdbId: 100, type: MediaType.MOVIE, extra: 'field1' },
        { id: '2', tmdbId: null, type: MediaType.SHOW, extra: 'field2' },
        { id: '3', tmdbId: 200, type: MediaType.SHOW, extra: 'field3' },
      ];

      const result = toMediaIdItems(rows);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { id: '1', tmdbId: 100, type: MediaType.MOVIE },
        { id: '3', tmdbId: 200, type: MediaType.SHOW },
      ]);
    });

    it('returns empty array for empty input', () => {
      const result = toMediaIdItems([]);

      expect(result).toHaveLength(0);
    });

    it('returns empty array when all tmdbIds are null', () => {
      const rows = [
        { id: '1', tmdbId: null, type: MediaType.MOVIE },
        { id: '2', tmdbId: null, type: MediaType.SHOW },
      ];

      const result = toMediaIdItems(rows);

      expect(result).toHaveLength(0);
    });

    it('preserves order of valid rows', () => {
      const rows = [
        { id: 'a', tmdbId: 1, type: MediaType.MOVIE },
        { id: 'b', tmdbId: null, type: MediaType.MOVIE },
        { id: 'c', tmdbId: 2, type: MediaType.SHOW },
        { id: 'd', tmdbId: null, type: MediaType.SHOW },
        { id: 'e', tmdbId: 3, type: MediaType.MOVIE },
      ];

      const result = toMediaIdItems(rows);

      expect(result.map((r) => r.id)).toEqual(['a', 'c', 'e']);
    });
  });
});
