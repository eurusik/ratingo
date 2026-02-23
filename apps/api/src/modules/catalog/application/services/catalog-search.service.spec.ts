import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '@/common/enums/media-type.enum';

import {
  type IMediaMetadataPort,
  MEDIA_METADATA_PORT,
} from '../../domain/ports/media-metadata.port';
import { MEDIA_REPOSITORY } from '../../domain/repositories/media.repository.interface';
import { SEARCH_SOURCE } from '../../domain/types/search.types';

import { CatalogSearchService } from './catalog-search.service';

describe('CatalogSearchService', () => {
  let service: CatalogSearchService;
  let mediaRepository: any;
  let metadataPort: jest.Mocked<IMediaMetadataPort>;

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
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
    };

    const mockMetadataPort: jest.Mocked<IMediaMetadataPort> = {
      getMovie: jest.fn(),
      getShow: jest.fn(),
      searchMulti: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogSearchService,
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: MEDIA_METADATA_PORT, useValue: mockMetadataPort },
      ],
    }).compile();

    service = module.get<CatalogSearchService>(CatalogSearchService);
    metadataPort = module.get(MEDIA_METADATA_PORT);
  });

  it('should return empty results for short query', async () => {
    const result = await service.search('a');

    expect(result.local).toEqual([]);
    expect(result.tmdb).toEqual([]);
    expect(mediaRepository.search).not.toHaveBeenCalled();
    expect(metadataPort.searchMulti).not.toHaveBeenCalled();
  });

  it('should combine local and tmdb results', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    metadataPort.searchMulti.mockResolvedValue([mockTmdbMovie]);

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
        isImported: false,
      }),
    );
  });

  it('should filter out TMDB results that exist locally (deduplication)', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    metadataPort.searchMulti.mockResolvedValue([mockTmdbMovie, mockDuplicateTmdbMovie]);

    const result = await service.search('movie');

    expect(result.local).toHaveLength(1);
    expect(result.local[0].tmdbId).toBe(100);

    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0].tmdbId).toBe(200);

    const duplicate = result.tmdb.find((m) => m.tmdbId === 100);
    expect(duplicate).toBeUndefined();
  });

  it('should mark TMDB results as imported when they exist in DB', async () => {
    metadataPort.searchMulti.mockResolvedValue([mockTmdbMovie]);
    mediaRepository.findManyByTmdbIds.mockResolvedValue([
      { id: 'uuid-2', tmdbId: 200, alternativeTitles: null },
    ]);

    const result = await service.search('movie');

    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0].isImported).toBe(true);
    expect(mediaRepository.findManyByTmdbIds).toHaveBeenCalledWith([200]);
  });

  it('should enrich TMDB results with alternative titles from DB', async () => {
    metadataPort.searchMulti.mockResolvedValue([mockTmdbMovie]);
    mediaRepository.findManyByTmdbIds.mockResolvedValue([
      { id: 'uuid-2', tmdbId: 200, alternativeTitles: ['Alt Title 1', 'Alt Title 2'] },
    ]);

    const result = await service.search('movie');

    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0].isImported).toBe(true);
    expect(result.tmdb[0].alternativeTitles).toEqual(['Alt Title 1', 'Alt Title 2']);
  });

  it('should set alternativeTitles to null for TMDB items not in DB', async () => {
    metadataPort.searchMulti.mockResolvedValue([mockTmdbMovie]);

    const result = await service.search('movie');

    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0].alternativeTitles).toBeNull();
  });

  it('should handle errors gracefully and return empty results', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    metadataPort.searchMulti.mockRejectedValue(new Error('TMDB Down'));

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
    metadataPort.searchMulti.mockResolvedValue(manyMovies);

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

  it('should boost TMDB results with alt titles to the top', async () => {
    const plainMovie = {
      ...mockTmdbMovie,
      externalIds: { tmdbId: 300, imdbId: 'tt300' },
      title: 'Stick in the Mud',
    };
    const enrichedMovie = {
      ...mockTmdbMovie,
      externalIds: { tmdbId: 200, imdbId: 'tt200' },
      title: 'У багні',
    };
    // TMDB returns plain first, enriched second
    metadataPort.searchMulti.mockResolvedValue([plainMovie, enrichedMovie]);
    mediaRepository.findManyByTmdbIds.mockResolvedValue([
      { id: 'uuid-2', tmdbId: 200, alternativeTitles: ['In the Mud'] },
    ]);

    const result = await service.search('In the Mud');

    expect(result.tmdb[0].tmdbId).toBe(200);
    expect(result.tmdb[0].alternativeTitles).toEqual(['In the Mud']);
    expect(result.tmdb[1].tmdbId).toBe(300);
    expect(result.tmdb[1].alternativeTitles).toBeNull();
  });

  it('should pass correct parameters to repository and adapter', async () => {
    await service.search('test query');

    expect(mediaRepository.search).toHaveBeenCalledWith('test query', 10);
    expect(metadataPort.searchMulti).toHaveBeenCalledWith('test query', 1);
  });
});
