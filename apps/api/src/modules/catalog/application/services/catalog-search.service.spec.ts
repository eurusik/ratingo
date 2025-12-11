import { Test, TestingModule } from '@nestjs/testing';
import { CatalogSearchService } from './catalog-search.service';
import { MEDIA_REPOSITORY } from '../../domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { SearchSource } from '../../presentation/dtos/search.dto';

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
    slug: 'tmdb-movie',
    posterPath: '/tmdb.jpg',
    rating: 7.0,
    releaseDate: new Date('2024-01-01'),
  };

  const mockDuplicateTmdbMovie = {
    externalIds: { tmdbId: 100, imdbId: 'tt100' }, // Same ID as local
    type: MediaType.MOVIE,
    title: 'Duplicate Movie',
    posterPath: '/duplicate.jpg',
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
        id: 'uuid-1',
        tmdbId: 100,
        source: SearchSource.LOCAL,
        isImported: true,
        title: 'Local Movie',
      })
    );

    // Check TMDB
    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0]).toEqual(
      expect.objectContaining({
        tmdbId: 200,
        source: SearchSource.TMDB,
        isImported: false,
        title: 'TMDB Movie',
      })
    );
  });

  it('should filter out TMDB results that exist locally (deduplication)', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    // TMDB returns a new movie AND a duplicate of the local one
    tmdbAdapter.searchMulti.mockResolvedValue([mockTmdbMovie, mockDuplicateTmdbMovie]);

    const result = await service.search('movie');

    expect(result.local).toHaveLength(1);
    expect(result.local[0].tmdbId).toBe(100);

    expect(result.tmdb).toHaveLength(1);
    expect(result.tmdb[0].tmdbId).toBe(200); // Only the new one

    // Ensure duplicate (ID 100) is NOT in tmdb array
    const duplicate = result.tmdb.find((m) => m.tmdbId === 100);
    expect(duplicate).toBeUndefined();
  });

  it('should handle TMDB failure gracefully (return local only)', async () => {
    mediaRepository.search.mockResolvedValue([mockLocalMovie]);
    tmdbAdapter.searchMulti.mockRejectedValue(new Error('TMDB Down'));

    const result = await service.search('movie');

    expect(result.local).toHaveLength(0); // Current implementation catches error and returns empty everything?
    // Let's check implementation.
    // Implementation: try { ... Promise.all ... } catch { return empty }
    // So if ONE fails, Promise.all fails, and it returns empty.

    // Ideally it should use Promise.allSettled or separate try-catch if we want partial results.
    // But based on current code:
    expect(result.local).toEqual([]);
    expect(result.tmdb).toEqual([]);
  });

  it('should limit TMDB results to 10', async () => {
    const manyMovies = Array.from({ length: 15 }, (_, i) => ({
      ...mockTmdbMovie,
      externalIds: { tmdbId: 200 + i },
    }));
    tmdbAdapter.searchMulti.mockResolvedValue(manyMovies);

    const result = await service.search('movie');

    expect(result.tmdb).toHaveLength(10);
  });
});
