import { Test, TestingModule } from '@nestjs/testing';
import { CatalogMoviesController } from './catalog.movies.controller';
import { MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { NotFoundException } from '@nestjs/common';
import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';

describe('CatalogMoviesController', () => {
  let controller: CatalogMoviesController;
  let movieRepository: any;
  let userStateEnricher: any;
  let cards: any;

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

    const mockCards = {
      enrichCatalogItems: jest.fn((items: any[]) => items),
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
        { provide: CardEnrichmentService, useValue: mockCards },
      ],
    }).compile();

    controller = module.get<CatalogMoviesController>(CatalogMoviesController);
    movieRepository = module.get(MOVIE_REPOSITORY);
    userStateEnricher = module.get(CatalogUserStateEnricher);
    cards = module.get(CardEnrichmentService);
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
    it('returns details with card when found', async () => {
      const mockMovie = {
        id: '1',
        title: 'Matrix',
        slug: 'the-matrix',
        releaseDate: null,
        externalRatings: {
          imdb: null,
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      };
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await controller.getMovieBySlug('the-matrix');

      expect(movieRepository.findBySlug).toHaveBeenCalledWith('the-matrix');
      expect(result.id).toBe('1');
      expect(result.userState).toBeNull();
      expect(result.card).toBeDefined();
      expect(result.card.badgeKey).toBeNull(); // No badge for default context without signals
    });

    it('throws NotFoundException when not found', async () => {
      movieRepository.findBySlug.mockResolvedValue(null);
      await expect(controller.getMovieBySlug('unknown')).rejects.toThrow(NotFoundException);
    });

    it('returns verdict computed from movie data', async () => {
      const mockMovie = {
        id: '1',
        title: 'Good Movie',
        slug: 'good-movie',
        releaseDate: new Date('2024-01-01'),
        theatricalReleaseDate: new Date('2024-01-01'),
        digitalReleaseDate: new Date('2024-06-01'),
        stats: {
          ratingoScore: 75,
          qualityScore: 70,
          popularityScore: 60,
        },
        externalRatings: {
          imdb: { rating: 7.5, voteCount: 5000 },
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      };
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await controller.getMovieBySlug('good-movie');

      expect(result.verdict).toBeDefined();
      expect(result.verdict.type).toBeDefined();
      expect(result.verdict.hintKey).toBeDefined();
      expect(['warning', 'release', 'quality', 'popularity', 'general']).toContain(
        result.verdict.type,
      );
    });

    it('returns warning verdict for low-rated movie with confident votes', async () => {
      const mockMovie = {
        id: '1',
        title: 'Bad Movie',
        slug: 'bad-movie',
        releaseDate: new Date('2024-01-01'),
        stats: {
          ratingoScore: 35,
          qualityScore: 30,
          popularityScore: 20,
        },
        externalRatings: {
          imdb: { rating: 4.5, voteCount: 500 }, // >= 200 for confidence
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      };
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await controller.getMovieBySlug('bad-movie');

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('poorRatings');
    });

    it('returns releaseStatus computed from dates', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const mockMovie = {
        id: '1',
        title: 'Upcoming Movie',
        slug: 'upcoming-movie',
        releaseDate: futureDate,
        theatricalReleaseDate: futureDate,
        digitalReleaseDate: null,
        stats: { ratingoScore: null },
        externalRatings: {
          imdb: null,
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      };
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await controller.getMovieBySlug('upcoming-movie');

      expect(result.releaseStatus).toBe('upcoming');
    });
  });
});
