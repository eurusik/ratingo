import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';
import { SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';
import { NotFoundException } from '@nestjs/common';

describe('CatalogController', () => {
  let controller: CatalogController;
  let movieRepository: any;
  let showRepository: any;

  beforeEach(async () => {
    const mockMovieRepository = {
      findNowPlaying: jest.fn().mockResolvedValue([{ id: 1, title: 'Movie' }]),
      findNewReleases: jest.fn().mockResolvedValue([{ id: 2, title: 'New Movie' }]),
      findNewOnDigital: jest.fn().mockResolvedValue([{ id: 3, title: 'Digital Movie' }]),
      findBySlug: jest.fn(),
    };

    const mockShowRepository = {
      findEpisodesByDateRange: jest.fn().mockResolvedValue([
        { 
          airDate: new Date('2024-01-01T10:00:00Z'), 
          title: 'Ep 1',
          showTitle: 'Show A'
        },
        { 
          airDate: new Date('2024-01-01T11:00:00Z'), 
          title: 'Ep 2',
          showTitle: 'Show B'
        },
        { 
          airDate: new Date('2024-01-02T10:00:00Z'), 
          title: 'Ep 3',
          showTitle: 'Show A'
        }
      ]),
      findBySlug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: MOVIE_REPOSITORY, useValue: mockMovieRepository },
        { provide: SHOW_REPOSITORY, useValue: mockShowRepository },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    movieRepository = module.get(MOVIE_REPOSITORY);
    showRepository = module.get(SHOW_REPOSITORY);
  });

  describe('getNowPlaying', () => {
    it('should return movies with default params', async () => {
      const result = await controller.getNowPlaying();

      expect(movieRepository.findNowPlaying).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta.count).toBe(1);
    });

    it('should return movies with custom params', async () => {
      await controller.getNowPlaying(10, 5);

      expect(movieRepository.findNowPlaying).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('getNewReleases', () => {
    it('should return new releases', async () => {
      await controller.getNewReleases(15, 0, 60);

      expect(movieRepository.findNewReleases).toHaveBeenCalledWith({
        limit: 15,
        offset: 0,
        daysBack: 60,
      });
    });
  });

  describe('getNewOnDigital', () => {
    it('should return digital releases', async () => {
      await controller.getNewOnDigital(25);

      expect(movieRepository.findNewOnDigital).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 })
      );
    });
  });

  describe('getCalendar', () => {
    it('should return grouped episodes by date', async () => {
      const result = await controller.getCalendar('2024-01-01', 7);

      expect(showRepository.findEpisodesByDateRange).toHaveBeenCalled();
      
      // Check grouping logic
      expect(result.days).toHaveLength(2);
      
      const day1 = result.days.find(d => d.date === '2024-01-01');
      expect(day1).toBeDefined();
      expect(day1.episodes).toHaveLength(2);

      const day2 = result.days.find(d => d.date === '2024-01-02');
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
      expect(result).toEqual(mockMovie);
    });

    it('should throw NotFoundException when movie not found', async () => {
      movieRepository.findBySlug.mockResolvedValue(null);

      await expect(controller.getMovieBySlug('unknown-movie'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('getShowBySlug', () => {
    it('should return show details when found', async () => {
      const mockShow = { id: '2', title: 'Arcane', slug: 'arcane' };
      showRepository.findBySlug.mockResolvedValue(mockShow);

      const result = await controller.getShowBySlug('arcane');

      expect(showRepository.findBySlug).toHaveBeenCalledWith('arcane');
      expect(result).toEqual(mockShow);
    });

    it('should throw NotFoundException when show not found', async () => {
      showRepository.findBySlug.mockResolvedValue(null);

      await expect(controller.getShowBySlug('unknown-show'))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});
