import { Test, TestingModule } from '@nestjs/testing';
import { CatalogMoviesController } from './catalog.movies.controller';
import { MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { NotFoundException } from '@nestjs/common';

describe('CatalogMoviesController', () => {
  let controller: CatalogMoviesController;
  let movieRepository: any;
  let userStateEnricher: any;

  beforeEach(async () => {
    const mockMovieRepository = {
      findNowPlaying: jest
        .fn()
        .mockResolvedValue([
          { id: 1, title: 'Movie', stats: { popularityScore: 80 }, type: 'movie' },
        ]),
      findNewReleases: jest.fn().mockResolvedValue([{ id: 2, title: 'New Movie', type: 'movie' }]),
      findNewOnDigital: jest
        .fn()
        .mockResolvedValue([{ id: 3, title: 'Digital Movie', type: 'movie' }]),
      findTrending: jest
        .fn()
        .mockResolvedValue([{ id: 'tm-1', title: 'Trending Movie', type: 'movie' }]),
      findBySlug: jest.fn(),
    };

    const mockUserStateEnricher = {
      enrichList: jest.fn(async (_userId: string | null, items: any[]) =>
        items.map((i) => ({ ...i, userState: null })),
      ),
      enrichOne: jest.fn(async (_userId: string | null, item: any) => ({
        ...item,
        userState: null,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogMoviesController],
      providers: [
        { provide: MOVIE_REPOSITORY, useValue: mockMovieRepository },
        { provide: CatalogUserStateEnricher, useValue: mockUserStateEnricher },
      ],
    }).compile();

    controller = module.get<CatalogMoviesController>(CatalogMoviesController);
    movieRepository = module.get(MOVIE_REPOSITORY);
    userStateEnricher = module.get(CatalogUserStateEnricher);
  });

  describe('getTrendingMovies', () => {
    it('returns trending movies with meta', async () => {
      const result = await controller.getTrendingMovies({ limit: 10, offset: 0 } as any, null);

      expect(movieRepository.findTrending).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(result.meta).toEqual({ count: 1, total: 1, limit: 10, offset: 0, hasMore: false });
    });
  });

  describe('getNowPlaying', () => {
    it('uses defaults and enriches', async () => {
      const result = await controller.getNowPlaying({} as any);

      expect(movieRepository.findNowPlaying).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 }),
      );
      expect(result.data).toHaveLength(1);
      expect(userStateEnricher.enrichList).toHaveBeenCalled();
    });
  });

  describe('getNewReleases', () => {
    it('passes parameters to repo', async () => {
      await controller.getNewReleases({ limit: 15, offset: 0, daysBack: 60 } as any);
      expect(movieRepository.findNewReleases).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 15, offset: 0, daysBack: 60 }),
      );
    });
  });

  describe('getNewOnDigital', () => {
    it('applies default daysBack and pagination', async () => {
      await controller.getNewOnDigital({ limit: 25 } as any);
      expect(movieRepository.findNewOnDigital).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25, daysBack: 14 }),
      );
    });
  });

  describe('getMovieBySlug', () => {
    it('returns details when found', async () => {
      const mockMovie = { id: '1', title: 'Matrix', slug: 'the-matrix' };
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await controller.getMovieBySlug('the-matrix');

      expect(movieRepository.findBySlug).toHaveBeenCalledWith('the-matrix');
      expect(result).toEqual({ ...mockMovie, userState: null });
    });

    it('throws NotFoundException when not found', async () => {
      movieRepository.findBySlug.mockResolvedValue(null);
      await expect(controller.getMovieBySlug('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
