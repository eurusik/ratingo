import { GenrePersistenceMapper } from './genre-persistence.mapper';

describe('GenrePersistenceMapper', () => {
  describe('toGenreInsertValues', () => {
    it('should map genre data to insert values', () => {
      const genres = [
        { tmdbId: 28, name: 'Action', slug: 'action' },
        { tmdbId: 35, name: 'Comedy', slug: 'comedy' },
      ];

      const result = GenrePersistenceMapper.toGenreInsertValues(genres);

      expect(result).toEqual([
        { tmdbId: 28, name: 'Action', slug: 'action' },
        { tmdbId: 35, name: 'Comedy', slug: 'comedy' },
      ]);
    });

    it('should return empty array for empty input', () => {
      const result = GenrePersistenceMapper.toGenreInsertValues([]);

      expect(result).toEqual([]);
    });
  });

  describe('toMediaGenresInsertValues', () => {
    it('should map genre ids to media_genres insert values', () => {
      const mediaId = 'media-123';
      const genreIds = [{ id: 'genre-1' }, { id: 'genre-2' }];

      const result = GenrePersistenceMapper.toMediaGenresInsertValues(mediaId, genreIds);

      expect(result).toEqual([
        { mediaItemId: 'media-123', genreId: 'genre-1' },
        { mediaItemId: 'media-123', genreId: 'genre-2' },
      ]);
    });

    it('should return empty array for empty genre ids', () => {
      const result = GenrePersistenceMapper.toMediaGenresInsertValues('media-123', []);

      expect(result).toEqual([]);
    });
  });
});
