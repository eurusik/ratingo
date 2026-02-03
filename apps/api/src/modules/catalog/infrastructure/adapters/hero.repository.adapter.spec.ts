import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { HeroMediaQuery } from '../queries/hero-media.query';
import { WatchingNowMediaQuery } from '../queries/watching-now-media.query';

import { HeroRepositoryAdapter } from './hero.repository.adapter';

describe('HeroRepositoryAdapter', () => {
  let adapter: HeroRepositoryAdapter;
  let heroMediaQuery: jest.Mocked<Partial<HeroMediaQuery>>;
  let watchingNowMediaQuery: jest.Mocked<Partial<WatchingNowMediaQuery>>;

  const createMockHeroItem = (id: string): HeroMediaItem => ({
    id,
    mediaItemId: id,
    type: MediaType.MOVIE,
    slug: `movie-${id}`,
    title: `Movie ${id}`,
    originalTitle: null,
    overview: 'Test overview',
    primaryTrailerKey: 'abc123',
    poster: {
      small: '/poster-small.jpg',
      medium: '/poster-medium.jpg',
      large: '/poster-large.jpg',
      original: '/poster-original.jpg',
    },
    backdrop: {
      small: '/backdrop-small.jpg',
      medium: '/backdrop-medium.jpg',
      large: '/backdrop-large.jpg',
      original: '/backdrop-original.jpg',
    },
    releaseDate: new Date('2024-01-01'),
    isNew: true,
    isClassic: false,
    stats: {
      ratingoScore: 85,
      qualityScore: 80,
      popularityScore: 70,
      liveWatchers: 100,
      totalWatchers: 5000,
    },
    externalRatings: {
      tmdb: { rating: 7.5, voteCount: 1000 },
      imdb: null,
      trakt: null,
      metacritic: null,
      rottenTomatoes: null,
    },
  });

  beforeEach(async () => {
    heroMediaQuery = {
      execute: jest.fn(),
    };

    watchingNowMediaQuery = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeroRepositoryAdapter,
        { provide: HeroMediaQuery, useValue: heroMediaQuery },
        { provide: WatchingNowMediaQuery, useValue: watchingNowMediaQuery },
      ],
    }).compile();

    adapter = module.get<HeroRepositoryAdapter>(HeroRepositoryAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('findHero', () => {
    it('should delegate to heroMediaQuery.execute with limit', async () => {
      const mockItems = [createMockHeroItem('1'), createMockHeroItem('2')];
      heroMediaQuery.execute!.mockResolvedValue(mockItems);

      const result = await adapter.findHero(5);

      expect(heroMediaQuery.execute).toHaveBeenCalledWith({ limit: 5 });
      expect(heroMediaQuery.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockItems);
    });

    it('should delegate to heroMediaQuery.execute with limit and type', async () => {
      const mockItems = [createMockHeroItem('1')];
      heroMediaQuery.execute!.mockResolvedValue(mockItems);

      const result = await adapter.findHero(3, MediaType.MOVIE);

      expect(heroMediaQuery.execute).toHaveBeenCalledWith({
        limit: 3,
        type: MediaType.MOVIE,
      });
      expect(result).toEqual(mockItems);
    });

    it('should return empty array when no items found', async () => {
      heroMediaQuery.execute!.mockResolvedValue([]);

      const result = await adapter.findHero(5);

      expect(result).toEqual([]);
    });

    it('should pass undefined type when not specified', async () => {
      heroMediaQuery.execute!.mockResolvedValue([]);

      await adapter.findHero(10);

      expect(heroMediaQuery.execute).toHaveBeenCalledWith({
        limit: 10,
        type: undefined,
      });
    });
  });

  describe('findWatchingNow', () => {
    it('should delegate to watchingNowMediaQuery.execute', async () => {
      const mockItems = [createMockHeroItem('1'), createMockHeroItem('2')];
      watchingNowMediaQuery.execute!.mockResolvedValue(mockItems);

      const result = await adapter.findWatchingNow(3);

      expect(watchingNowMediaQuery.execute).toHaveBeenCalledWith({ limit: 3 });
      expect(watchingNowMediaQuery.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockItems);
    });

    it('should return empty array when no items found', async () => {
      watchingNowMediaQuery.execute!.mockResolvedValue([]);

      const result = await adapter.findWatchingNow(3);

      expect(result).toEqual([]);
    });
  });

  describe('interface compliance', () => {
    it('should implement IHeroRepository interface', () => {
      expect(typeof adapter.findHero).toBe('function');
      expect(typeof adapter.findWatchingNow).toBe('function');
    });
  });
});
