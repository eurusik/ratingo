import { MediaType } from '@/common/enums/media-type.enum';

import { TmdbMetadataAdapter } from './tmdb-metadata.adapter';

describe('TmdbMetadataAdapter', () => {
  const mockTmdbAdapter = {
    getMovie: jest.fn(),
    getShow: jest.fn(),
    searchMulti: jest.fn(),
  };

  const adapter = new TmdbMetadataAdapter(mockTmdbAdapter as any);

  afterEach(() => jest.clearAllMocks());

  describe('getMovie', () => {
    it('should return { title } when movie exists', async () => {
      mockTmdbAdapter.getMovie.mockResolvedValue({
        title: 'The Matrix',
        tmdbId: 603,
        runtime: 120,
      });

      const result = await adapter.getMovie(603);

      expect(result).toEqual({ title: 'The Matrix' });
      expect(mockTmdbAdapter.getMovie).toHaveBeenCalledWith(603);
    });

    it('should return null when movie not found', async () => {
      mockTmdbAdapter.getMovie.mockResolvedValue(null);

      expect(await adapter.getMovie(999)).toBeNull();
    });
  });

  describe('getShow', () => {
    it('should return { title } when show exists', async () => {
      mockTmdbAdapter.getShow.mockResolvedValue({
        title: 'Breaking Bad',
        tmdbId: 1396,
        numberOfSeasons: 5,
      });

      const result = await adapter.getShow(1396);

      expect(result).toEqual({ title: 'Breaking Bad' });
      expect(mockTmdbAdapter.getShow).toHaveBeenCalledWith(1396);
    });

    it('should return null when show not found', async () => {
      mockTmdbAdapter.getShow.mockResolvedValue(null);

      expect(await adapter.getShow(999)).toBeNull();
    });
  });

  describe('searchMulti', () => {
    it('should map results to MetadataSearchResult shape', async () => {
      const tmdbResults = [
        {
          externalIds: { tmdbId: 603 },
          type: MediaType.MOVIE,
          title: 'The Matrix',
          originalTitle: 'The Matrix',
          releaseDate: '1999-03-31',
          posterPath: '/poster.jpg',
          rating: 8.7,
          extraField: 'should be stripped',
        },
      ];
      mockTmdbAdapter.searchMulti.mockResolvedValue(tmdbResults);

      const result = await adapter.searchMulti('matrix', 1);

      expect(result).toEqual([
        {
          externalIds: { tmdbId: 603 },
          type: MediaType.MOVIE,
          title: 'The Matrix',
          originalTitle: 'The Matrix',
          releaseDate: '1999-03-31',
          posterPath: '/poster.jpg',
          rating: 8.7,
        },
      ]);
      expect(mockTmdbAdapter.searchMulti).toHaveBeenCalledWith('matrix', 1);
    });

    it('should return empty array when no results', async () => {
      mockTmdbAdapter.searchMulti.mockResolvedValue([]);

      const result = await adapter.searchMulti('nonexistent');

      expect(result).toEqual([]);
    });
  });
});
