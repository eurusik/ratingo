import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';
import { SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';
import { NotFoundException } from '@nestjs/common';
import { CatalogSearchService } from '../../application/services/catalog-search.service';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';

describe('CatalogController', () => {
  let controller: CatalogController;
  let movieRepository: any;
  let showRepository: any;
  let catalogSearchService: any;
  let userStateEnricher: any;

  beforeEach(async () => {
    const mockMovieRepository = {
      findNowPlaying: jest.fn().mockResolvedValue([
        {
          id: 1,
          title: 'Movie',
          stats: { liveWatchers: 50, totalWatchers: 5000, popularityScore: 80 },
        },
      ]),
      findNewReleases: jest.fn().mockResolvedValue([{ id: 2, title: 'New Movie' }]),
      findNewOnDigital: jest.fn().mockResolvedValue([{ id: 3, title: 'Digital Movie' }]),
      findBySlug: jest.fn(),
      findTrending: jest
        .fn()
        .mockResolvedValue([{ id: 'tm-1', title: 'Trending Movie', type: 'movie' }]),
    };

    const mockShowRepository = {
      findEpisodesByDateRange: jest.fn().mockResolvedValue([
        {
          airDate: new Date('2024-01-01T10:00:00Z'),
          title: 'Ep 1',
          showTitle: 'Show A',
        },
        {
          airDate: new Date('2024-01-01T11:00:00Z'),
          title: 'Ep 2',
          showTitle: 'Show B',
        },
        {
          airDate: new Date('2024-01-02T10:00:00Z'),
          title: 'Ep 3',
          showTitle: 'Show A',
        },
      ]),
      findBySlug: jest.fn(),
      findTrending: jest
        .fn()
        .mockResolvedValue([{ id: 'trending-1', title: 'Trending Show', type: 'show' }]),
    };

    const mockCatalogSearchService = {
      search: jest.fn().mockResolvedValue({ query: 'test', local: [], tmdb: [] }),
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
      controllers: [CatalogController],
      providers: [
        { provide: MOVIE_REPOSITORY, useValue: mockMovieRepository },
        { provide: SHOW_REPOSITORY, useValue: mockShowRepository },
        { provide: CatalogSearchService, useValue: mockCatalogSearchService },
        { provide: CatalogUserStateEnricher, useValue: mockUserStateEnricher },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    movieRepository = module.get(MOVIE_REPOSITORY);
    showRepository = module.get(SHOW_REPOSITORY);
    catalogSearchService = module.get(CatalogSearchService);
    userStateEnricher = module.get(CatalogUserStateEnricher);
  });

  describe('search', () => {
    it('should call catalogSearchService.search', async () => {
      const result = await controller.search('matrix');
      expect(catalogSearchService.search).toHaveBeenCalledWith('matrix');
      expect(result).toBeDefined();
    });
  });

  describe('getNowPlaying', () => {
    it('should return movies with default params', async () => {
      const result = await controller.getNowPlaying({} as any);

      expect(movieRepository.findNowPlaying).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sort: 'popularity',
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta.count).toBe(1);
    });

    it('should return movies with custom params', async () => {
      await controller.getNowPlaying({ limit: 10, offset: 5 } as any);

      expect(movieRepository.findNowPlaying).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        sort: 'popularity',
      });
    });
  });

  describe('getNewReleases', () => {
    it('should return new releases', async () => {
      await controller.getNewReleases({ limit: 15, offset: 0, daysBack: 60 } as any);

      expect(movieRepository.findNewReleases).toHaveBeenCalledWith({
        limit: 15,
        offset: 0,
        daysBack: 60,
        sort: 'popularity',
      });
    });
  });

  describe('getNewOnDigital', () => {
    it('should return digital releases', async () => {
      await controller.getNewOnDigital({ limit: 25 } as any);

      expect(movieRepository.findNewOnDigital).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25, sort: 'popularity' }),
      );
    });
  });

  describe('getTrendingShows', () => {
    it('should return trending shows', async () => {
      const result = await controller.getTrendingShows({ limit: 10, offset: 0 }, null);

      expect(showRepository.findTrending).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        sort: undefined,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('show');
    });

    it('should respect pagination and filters', async () => {
      await controller.getTrendingShows(
        {
          limit: 50,
          offset: 10,
          minRating: 80,
          genreId: 'uuid-genre',
          sort: undefined,
        },
        null,
      );

      expect(showRepository.findTrending).toHaveBeenCalledWith({
        limit: 50,
        offset: 10,
        minRating: 80,
        genreId: 'uuid-genre',
      });
    });

    it('should return correct meta data', async () => {
      showRepository.findTrending.mockResolvedValue([
        { id: '1', title: 'Show 1', type: 'show' },
        { id: '2', title: 'Show 2', type: 'show' },
      ]);

      const result = await controller.getTrendingShows({ limit: 10, offset: 0 }, null);

      expect(result.meta).toEqual({
        count: 2,
        limit: 10,
        offset: 0,
      });
    });
  });

  describe('getTrendingMovies', () => {
    it('should return trending movies', async () => {
      const result = await controller.getTrendingMovies({ limit: 10, offset: 0 }, null);

      expect(movieRepository.findTrending).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('movie');
    });
  });

  describe('getCalendar', () => {
    it('should return grouped episodes by date', async () => {
      const result = await controller.getCalendar('2024-01-01', 7);

      expect(showRepository.findEpisodesByDateRange).toHaveBeenCalled();

      // Check grouping logic
      expect(result.days).toHaveLength(2);

      const day1 = result.days.find((d) => d.date === '2024-01-01');
      expect(day1).toBeDefined();
      expect(day1.episodes).toHaveLength(2);

      const day2 = result.days.find((d) => d.date === '2024-01-02');
      expect(day2).toBeDefined();
      expect(day2.episodes).toHaveLength(1);
    });

    it('should use default parameters if not provided', async () => {
      await controller.getCalendar();
      expect(showRepository.findEpisodesByDateRange).toHaveBeenCalled();
    });
  });

  describe('getMovieBySlug', () => {
    it('should return movie details when found', async () => {
      const mockMovie = { id: '1', title: 'Matrix', slug: 'the-matrix' };
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await controller.getMovieBySlug('the-matrix');

      expect(movieRepository.findBySlug).toHaveBeenCalledWith('the-matrix');
      expect(result).toEqual({ ...mockMovie, userState: null });
    });

    it('should throw NotFoundException when movie not found', async () => {
      movieRepository.findBySlug.mockResolvedValue(null);

      await expect(controller.getMovieBySlug('unknown-movie')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getShowBySlug', () => {
    it('should return show details when found', async () => {
      const mockShow = { id: '2', title: 'Arcane', slug: 'arcane' };
      showRepository.findBySlug.mockResolvedValue(mockShow);

      const result = await controller.getShowBySlug('arcane');

      expect(showRepository.findBySlug).toHaveBeenCalledWith('arcane');
      expect(result).toEqual({ ...mockShow, userState: null });
    });

    it('should throw NotFoundException when show not found', async () => {
      showRepository.findBySlug.mockResolvedValue(null);

      await expect(controller.getShowBySlug('unknown-show')).rejects.toThrow(NotFoundException);
    });
  });
});
