import { Test, TestingModule } from '@nestjs/testing';
import { HomeController } from './home.controller';
import { HomeService } from '../application/home.service';
import { MediaType } from '../../../common/enums/media-type.enum';
import { HeroMediaItem } from '../../../common/types/hero-media.types';

describe('HomeController', () => {
  let controller: HomeController;
  let homeServiceMock: any;

  const createMockHeroItem = (overrides: Partial<HeroMediaItem> = {}): HeroMediaItem => ({
    id: '1',
    mediaItemId: '1',
    type: MediaType.MOVIE,
    slug: 'test-movie',
    title: 'Test',
    originalTitle: 'Test',
    overview: 'Overview',
    primaryTrailerKey: null,
    poster: { small: 's', medium: 'm', large: 'l', original: 'o' },
    backdrop: { small: 's', medium: 'm', large: 'l', original: 'o' },
    releaseDate: new Date('2024-01-01'),
    isNew: false,
    isClassic: false,
    stats: {
      ratingoScore: 80,
      qualityScore: 80,
      popularityScore: 70,
      liveWatchers: 100,
      totalWatchers: 5000,
    },
    externalRatings: {
      tmdb: { rating: 8.0, voteCount: 1000 },
      imdb: null,
      trakt: null,
      metacritic: null,
      rottenTomatoes: null,
    },
    ...overrides,
  });

  beforeEach(async () => {
    homeServiceMock = {
      getHero: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        {
          provide: HomeService,
          useValue: homeServiceMock,
        },
      ],
    }).compile();

    controller = module.get<HomeController>(HomeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHero', () => {
    it('should return mapped DTOs from service', async () => {
      const mockData = [createMockHeroItem()];
      homeServiceMock.getHero.mockResolvedValue(mockData);

      const result = await controller.getHero();

      expect(homeServiceMock.getHero).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].stats.ratingoScore).toBe(80);
      expect(result[0].externalRatings?.tmdb?.rating).toBe(8.0);
    });

    it('should pass type parameter to service', async () => {
      homeServiceMock.getHero.mockResolvedValue([]);

      await controller.getHero(MediaType.MOVIE);

      expect(homeServiceMock.getHero).toHaveBeenCalledWith(MediaType.MOVIE);
    });

    it('should map show progress for TV shows', async () => {
      const mockShow = createMockHeroItem({
        type: MediaType.SHOW,
        showProgress: {
          season: 2,
          episode: 5,
          label: 'S2E5',
          lastAirDate: new Date('2024-12-01'),
          nextAirDate: null,
        },
      });
      homeServiceMock.getHero.mockResolvedValue([mockShow]);

      const result = await controller.getHero();

      expect(result[0].showProgress).toBeDefined();
      expect(result[0].showProgress?.season).toBe(2);
      expect(result[0].showProgress?.episode).toBe(5);
      expect(result[0].showProgress?.label).toBe('S2E5');
    });

    it('should handle null external ratings', async () => {
      const mockItem = createMockHeroItem({
        externalRatings: {
          tmdb: null,
          imdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      });
      homeServiceMock.getHero.mockResolvedValue([mockItem]);

      const result = await controller.getHero();

      expect(result[0].externalRatings?.tmdb).toBeNull();
      expect(result[0].externalRatings?.imdb).toBeNull();
    });
  });
});
