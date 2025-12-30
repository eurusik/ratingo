import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { HERO_REPOSITORY } from '../domain/repositories/hero.repository.interface';
import { MediaType } from '../../../common/enums/media-type.enum';
import { HERO_CONFIG } from '../home.constants';

describe('HomeService', () => {
  let service: HomeService;
  let heroRepositoryMock: any;

  beforeEach(async () => {
    heroRepositoryMock = {
      findHero: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: HERO_REPOSITORY,
          useValue: heroRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<HomeService>(HomeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHero', () => {
    const mockHeroItems = [
      {
        id: '1',
        mediaItemId: '1',
        title: 'Movie 1',
        originalTitle: 'Movie 1',
        type: MediaType.MOVIE,
        slug: 'movie-1',
        primaryTrailerKey: 'key1',
        isNew: true,
        isClassic: false,
        overview: 'Overview 1',
        poster: { small: '', medium: '', large: '', original: '' },
        backdrop: { small: '', medium: '', large: '', original: '' },
        releaseDate: new Date(),
        stats: {
          ratingoScore: 80,
          qualityScore: 80,
          popularityScore: 70,
          liveWatchers: 100,
          totalWatchers: 1000,
        },
        externalRatings: {
          tmdb: { rating: 8.0, voteCount: 1000 },
          imdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      },
      {
        id: '2',
        mediaItemId: '2',
        title: 'Show 1',
        originalTitle: 'Show 1',
        type: MediaType.SHOW,
        slug: 'show-1',
        primaryTrailerKey: null,
        showProgress: {
          season: 1,
          episode: 1,
          label: 'S1E1',
          lastAirDate: null,
          nextAirDate: null,
        },
        isNew: false,
        isClassic: true,
        overview: 'Overview 2',
        poster: { small: '', medium: '', large: '', original: '' },
        backdrop: { small: '', medium: '', large: '', original: '' },
        releaseDate: new Date(),
        stats: {
          ratingoScore: 90,
          qualityScore: 90,
          popularityScore: 80,
          liveWatchers: 500,
          totalWatchers: 5000,
        },
        externalRatings: {
          tmdb: { rating: 9.0, voteCount: 5000 },
          imdb: { rating: 9.1, voteCount: 10000 },
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      },
    ];

    it('should return hero items from repository with configured limit', async () => {
      heroRepositoryMock.findHero.mockResolvedValue(mockHeroItems);

      const result = await service.getHero();

      expect(heroRepositoryMock.findHero).toHaveBeenCalledWith(
        HERO_CONFIG.DEFAULT_LIMIT,
        undefined,
      );
      expect(result).toEqual(mockHeroItems);
      expect(result[1].showProgress).toBeDefined();
    });

    it('should pass type parameter to repository', async () => {
      heroRepositoryMock.findHero.mockResolvedValue([mockHeroItems[0]]);

      const result = await service.getHero(MediaType.MOVIE);

      expect(heroRepositoryMock.findHero).toHaveBeenCalledWith(
        HERO_CONFIG.DEFAULT_LIMIT,
        MediaType.MOVIE,
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(MediaType.MOVIE);
    });

    it('should return empty array on repository error', async () => {
      heroRepositoryMock.findHero.mockRejectedValue(new Error('DB Error'));

      const result = await service.getHero();

      expect(result).toEqual([]);
    });
  });
});
