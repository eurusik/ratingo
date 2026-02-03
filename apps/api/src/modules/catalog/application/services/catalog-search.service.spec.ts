import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '@/common/enums/media-type.enum';
import { TmdbAdapter } from '@/modules/tmdb/public';

import { MEDIA_REPOSITORY } from '../../domain/repositories/media.repository.interface';
import { SEARCH_SOURCE } from '../../domain/types/search.types';

import { CatalogSearchService } from './catalog-search.service';

describe('CatalogSearchService', () => {
  let service: CatalogSearchService;
  let mediaRepository: any;
  let tmdbAdapter: any;

  const mockLocalMovie = {
    id: 'uuid-1',
    tmdbId: 100,
    type: MediaType.MOVIE,
    title: 'Local Movie',
    originalTitle: 'Original Local',
    slug: 'local-movie',
    posterPath: '/local.jpg',
    rating: 8.5,
    releaseDate: new Date('2023-01-01'),
  };

  const mockTmdbMovie = {
    externalIds: { tmdbId: 200, imdbId: 'tt200' },
    type: MediaType.MOVIE,
    title: 'TMDB Movie',
    originalTitle: 'Original TMDB',
    posterPath: '/tmdb.jpg',
    rating: 7.0,
    releaseDate: '2024-01-01',
  };

  const mockDuplicateTmdbMovie = {
    externalIds: { tmdbId: 100, imdbId: 'tt100' },
    type: MediaType.MOVIE,
    title: 'Duplicate Movie',
    originalTitle: null,
    posterPath: '/duplicate.jpg',
    rating: 0,
    releaseDate: null,
  };

  beforeEach(async () => {
    mediaRepository = {
      search: jest.fn().mockResolvedValue([]),
    };

    tmdbAdapter = {
      searchMulti: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogSearchService,
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: TmdbAdapter, useValue: tmdbAdapter },
      ],
    }).compile();

    service = module.get<CatalogSearchService>(CatalogSearchService);
  });

  it('should return empty results for short query', async () => {
    const result = await service.search('a');

    expect(result.local).toEqual([]);
    expect(result.tmdb).toEqual([]);
    expect(mediaRepository.search).not.toHaveBeenCalled();
    expect(tmdbAdapter.searchMulti).not.toHaveBeenCalled();
  });

  it('should combine local and tmdb results', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    tmdbAdapter.searchMulti.mockResolvedValue([mockTmdbMovie]);

    const result = await service.search('movie');

    expect(result.query).toBe('movie');

    // Check Local
    expect(result.local).toHaveLength(1);
    expect(result.local[0]).toEqual(
      expect.objectContaining({
        source: SEARCH_SOURCE.LOCAL,
        id: 'uuid-1',
        slug: 'local-movie',
        tmdbId: 100,
        title: 'Local Movie',
        posterPath: '/local.jpg',
        year: 2023,
      }),
    );

    // Check TMDB
    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0]).toEqual(
      expect.objectContaining({
        source: SEARCH_SOURCE.TMDB,
        tmdbId: 200,
        title: 'TMDB Movie',
        posterPath: '/tmdb.jpg',
        year: 2024,
      }),
    );
  });

  it('should filter out TMDB results that exist locally (deduplication)', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    tmdbAdapter.searchMulti.mockResolvedValue([mockTmdbMovie, mockDuplicateTmdbMovie]);

    const result = await service.search('movie');

    expect(result.local).toHaveLength(1);
    expect(result.local[0].tmdbId).toBe(100);

    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0].tmdbId).toBe(200);

    const duplicate = result.tmdb.find((m) => m.tmdbId === 100);
    expect(duplicate).toBeUndefined();
  });

  it('should handle errors gracefully and return empty results', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    tmdbAdapter.searchMulti.mockRejectedValue(new Error('TMDB Down'));

    const result = await service.search('movie');

    // Promise.all fails if any promise fails, so both are empty
    expect(result.local).toEqual([]);
    expect(result.tmdb).toEqual([]);
  });

  it('should limit TMDB results to configured limit', async () => {
    const manyMovies = Array.from({ length: 15 }, (_, i) => ({
      ...mockTmdbMovie,
      externalIds: { tmdbId: 200 + i },
    }));
    tmdbAdapter.searchMulti.mockResolvedValue(manyMovies);

    const result = await service.search('movie');

    expect(result.tmdb).toHaveLength(10);
  });

  it('should handle null releaseDate correctly', async () => {
    const movieWithNoDate = {
      ...mockLocalMovie,
      releaseDate: null,
    };
    mediaRepository.search.mockResolvedValue([movieWithNoDate]);

    const result = await service.search('movie');

    expect(result.local[0].year).toBeNull();
  });

  it('should pass correct parameters to repository and adapter', async () => {
    await service.search('test query');

    expect(mediaRepository.search).toHaveBeenCalledWith('test query', 10);
    expect(tmdbAdapter.searchMulti).toHaveBeenCalledWith('test query', 1);
  });
});
