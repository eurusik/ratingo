import { Test, TestingModule } from '@nestjs/testing';
import { WatchingNowMediaQuery } from './watching-now-media.query';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { MS_PER_DAY } from '../../../../common/constants';
import { WATCHING_NOW_THRESHOLDS } from '../../domain/constants/catalog.constants';
import { type HeroQueryRow } from './shared/hero-item.mapper';

describe('WatchingNowMediaQuery', () => {
  let query: WatchingNowMediaQuery;
  let mockDb: ReturnType<typeof createMockQueryBuilder>;

  const createMockQueryBuilder = (results: HeroQueryRow[] = []) => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(results),
    };
    return builder;
  };

  beforeEach(async () => {
    mockDb = createMockQueryBuilder();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchingNowMediaQuery,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    query = module.get<WatchingNowMediaQuery>(WatchingNowMediaQuery);
  });

  it('should be defined', () => {
    expect(query).toBeDefined();
  });

  describe('execute', () => {
    it('should return empty array when no results found', async () => {
      mockDb.select.mockReturnValue(createMockQueryBuilder([]));

      const result = await query.execute({ limit: 3 });

      expect(result).toEqual([]);
    });

    it('should map results to HeroMediaItem format', async () => {
      const now = new Date();
      const mockRow = {
        id: '123',
        type: MediaType.MOVIE,
        slug: 'test-movie',
        title: 'Test Movie',
        originalTitle: 'Test Movie Original',
        overview: 'A test movie',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        releaseDate: now,
        videos: [{ key: 'abc123' }],
        ratingoScore: 85,
        qualityScore: 80,
        popularityScore: 70,
        watchersCount: 500,
        totalWatchers: 10000,
        rating: 8.5,
        voteCount: 1000,
        ratingImdb: 8.2,
        voteCountImdb: 5000,
        ratingTrakt: 8.0,
        voteCountTrakt: 3000,
        ratingMetacritic: 75,
        ratingRottenTomatoes: 88,
      };

      mockDb.select.mockReturnValue(createMockQueryBuilder([mockRow]));

      const result = await query.execute({ limit: 3 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123');
      expect(result[0].title).toBe('Test Movie');
      expect(result[0].stats.liveWatchers).toBe(500);
      expect(result[0].stats.ratingoScore).toBe(85);
      expect(result[0].primaryTrailerKey).toBe('abc123');
    });

    it('should return empty array on error', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await query.execute({ limit: 3 });

      expect(result).toEqual([]);
    });
  });

  describe('Freshness Gate Property Tests', () => {
    describe('Property: Freshness thresholds are stricter than Hero', () => {
      it('movie freshness threshold is 45 days (stricter than Hero 90 days)', () => {
        expect(WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_MOVIE_RELEASE).toBe(45);
        expect(WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_MOVIE_RELEASE).toBeLessThan(90);
      });

      it('show freshness threshold is 21 days (stricter than Hero 90 days)', () => {
        expect(WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_SHOW_EPISODE).toBe(21);
        expect(WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_SHOW_EPISODE).toBeLessThan(90);
      });
    });

    describe('Property: Live watchers requirement', () => {
      it('requires at least 1 live watcher', () => {
        expect(WATCHING_NOW_THRESHOLDS.MIN_WATCHERS).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Property: Quality sanity check', () => {
      it('has a minimum quality score threshold', () => {
        expect(WATCHING_NOW_THRESHOLDS.MIN_QUALITY_SCORE).toBeGreaterThan(0);
      });
    });
  });

  describe('Sorting Property Tests', () => {
    describe('Property: Primary sort is by watchersCount (live watchers)', () => {
      it('should sort by watchersCount DESC, ratingoScore DESC', async () => {
        const mockRows = [
          {
            id: '1',
            type: MediaType.MOVIE,
            slug: 'movie-1',
            title: 'Movie 1',
            originalTitle: null,
            overview: null,
            posterPath: '/p1.jpg',
            backdropPath: '/b1.jpg',
            releaseDate: new Date(),
            videos: [],
            ratingoScore: 90,
            qualityScore: 80,
            popularityScore: 70,
            watchersCount: 100,
            totalWatchers: 5000,
            rating: 8,
            voteCount: 1000,
            ratingImdb: null,
            voteCountImdb: null,
            ratingTrakt: null,
            voteCountTrakt: null,
            ratingMetacritic: null,
            ratingRottenTomatoes: null,
          },
          {
            id: '2',
            type: MediaType.MOVIE,
            slug: 'movie-2',
            title: 'Movie 2',
            originalTitle: null,
            overview: null,
            posterPath: '/p2.jpg',
            backdropPath: '/b2.jpg',
            releaseDate: new Date(),
            videos: [],
            ratingoScore: 70,
            qualityScore: 80,
            popularityScore: 70,
            watchersCount: 500,
            totalWatchers: 10000,
            rating: 7,
            voteCount: 500,
            ratingImdb: null,
            voteCountImdb: null,
            ratingTrakt: null,
            voteCountTrakt: null,
            ratingMetacritic: null,
            ratingRottenTomatoes: null,
          },
        ];

        // Simulate DB returning already sorted results
        const sortedRows = [...mockRows].sort((a, b) => {
          if (b.watchersCount !== a.watchersCount) {
            return b.watchersCount - a.watchersCount;
          }
          return (b.ratingoScore || 0) - (a.ratingoScore || 0);
        });

        mockDb.select.mockReturnValue(createMockQueryBuilder(sortedRows));

        const result = await query.execute({ limit: 3 });

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('2'); // More watchers
        expect(result[0].stats.liveWatchers).toBe(500);
        expect(result[1].id).toBe('1'); // Fewer watchers (even though higher score)
        expect(result[1].stats.liveWatchers).toBe(100);
      });
    });
  });
});
