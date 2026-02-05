import {
  mapGenreRow,
  groupGenresByMediaId,
  type GenreQueryRow,
  type GenreWithMediaRow,
} from './genre.mapper';

describe('genre.mapper', () => {
  describe('mapGenreRow', () => {
    it('should map a row to GenreInfo', () => {
      const row: GenreQueryRow = {
        id: 'genre-123',
        name: 'Action',
        slug: 'action',
      };

      const result = mapGenreRow(row);

      expect(result).toEqual({
        id: 'genre-123',
        name: 'Action',
        slug: 'action',
      });
    });
  });

  describe('groupGenresByMediaId', () => {
    it('should group genres by mediaItemId', () => {
      const rows: GenreWithMediaRow[] = [
        { mediaItemId: 'media-1', id: 'genre-1', name: 'Action', slug: 'action' },
        { mediaItemId: 'media-1', id: 'genre-2', name: 'Comedy', slug: 'comedy' },
        { mediaItemId: 'media-2', id: 'genre-1', name: 'Action', slug: 'action' },
      ];

      const result = groupGenresByMediaId(rows);

      expect(result.size).toBe(2);
      expect(result.get('media-1')).toEqual([
        { id: 'genre-1', name: 'Action', slug: 'action' },
        { id: 'genre-2', name: 'Comedy', slug: 'comedy' },
      ]);
      expect(result.get('media-2')).toEqual([{ id: 'genre-1', name: 'Action', slug: 'action' }]);
    });

    it('should return empty map for empty input', () => {
      const result = groupGenresByMediaId([]);

      expect(result.size).toBe(0);
    });

    it('should handle single genre per media', () => {
      const rows: GenreWithMediaRow[] = [
        { mediaItemId: 'media-1', id: 'genre-1', name: 'Drama', slug: 'drama' },
      ];

      const result = groupGenresByMediaId(rows);

      expect(result.size).toBe(1);
      expect(result.get('media-1')).toEqual([{ id: 'genre-1', name: 'Drama', slug: 'drama' }]);
    });
  });
});
