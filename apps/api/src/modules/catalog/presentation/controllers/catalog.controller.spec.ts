import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';

describe('CatalogController', () => {
  let controller: CatalogController;
  let movieRepository: any;

  beforeEach(async () => {
    const mockMovieRepository = {
      findNowPlaying: jest.fn().mockResolvedValue([{ id: 1, title: 'Movie' }]),
      findNewReleases: jest.fn().mockResolvedValue([{ id: 2, title: 'New Movie' }]),
      findNewOnDigital: jest.fn().mockResolvedValue([{ id: 3, title: 'Digital Movie' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: MOVIE_REPOSITORY, useValue: mockMovieRepository },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    movieRepository = module.get(MOVIE_REPOSITORY);
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
});
