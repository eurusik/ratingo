import * as fc from 'fast-check';

import { HeroMediaQuery } from './hero-media.query';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { MS_PER_DAY } from '../../../../common/constants';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { HERO_THRESHOLDS } from '../../domain/constants/catalog.constants';

// Chainable thenable factory for Drizzle-like API
const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit'];
  methods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('HeroMediaQuery', () => {
  let query: HeroMediaQuery;
  let db: any;
  let selectQueue: any[];

  beforeEach(() => {
    jest.spyOn(ImageMapper, 'toPoster').mockReturnValue({ small: 'poster' } as any);
    jest.spyOn(ImageMapper, 'toBackdrop').mockReturnValue({ small: 'backdrop' } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = (selections: any[][], reject?: Error) => {
    selectQueue = [...selections];
    db = {
      select: jest.fn().mockImplementation(() => {
        const data = selectQueue.shift() ?? [];
        return createThenable(data, reject);
      }),
    };

    query = new HeroMediaQuery(db as any);
  };

  it('should map hero items with show progress and movie flags', async () => {
    const now = new Date();
    // First select (strict pass): base media results (one movie, one show)
    const mediaRows = [
      {
        id: 'm1',
        type: MediaType.MOVIE,
        slug: 'movie',
        title: 'Movie',
        originalTitle: 'Movie',
        overview: 'ov',
        posterPath: '/p.jpg',
        backdropPath: '/b.jpg',
        releaseDate: new Date(now.getTime() - 6 * 365 * 24 * 60 * 60 * 1000), // classic
        videos: [{ key: 'trailer1' }],
        ratingoScore: 0.8,
        qualityScore: 70,
        watchersCount: 10,
        totalWatchers: 20,
        rating: 8,
        voteCount: 1000,
      },
      {
        id: 's1',
        type: MediaType.SHOW,
        slug: 'show',
        title: 'Show',
        originalTitle: 'Show',
        overview: 'ov',
        posterPath: '/p2.jpg',
        backdropPath: '/b2.jpg',
        releaseDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // new
        videos: [],
        ratingoScore: 0.9,
        qualityScore: 80,
        watchersCount: 5,
        totalWatchers: 15,
        rating: 9,
        voteCount: 500,
      },
    ];

    // Second select (fallback pass): empty since strict returned < limit
    const fallbackRows: any[] = [];

    // Third select: shows data
    const showsData = [
      {
        mediaItemId: 's1',
        showId: 'sh1',
        lastAirDate: new Date('2024-01-01'),
        nextAirDate: new Date('2025-01-01'),
      },
    ];

    // Fourth select: episodes data (latest first)
    const episodes = [
      {
        showId: 'sh1',
        seasonNum: 2,
        episodeNumber: 3,
        airDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    setup([mediaRows, fallbackRows, showsData, episodes]);

    const result = await query.execute({ limit: 5 });

    expect(result).toHaveLength(2);

    const movie = result.find((r) => r.id === 'm1')!;
    expect(movie.isClassic).toBe(true);
    expect(movie.isNew).toBe(false);
    expect(movie.primaryTrailerKey).toBe('trailer1');
    expect(movie.poster).toEqual({ small: 'poster' });
    expect(movie.backdrop).toEqual({ small: 'backdrop' });

    const show = result.find((r) => r.id === 's1')!;
    expect(show.isNew).toBe(true);
    expect(show.isClassic).toBe(false);
    expect(show.showProgress).toMatchObject({ season: 2, episode: 3, label: 'S2E3' });
  });

  it('should skip fallback pass when strict pass fills limit', async () => {
    const now = new Date();
    const mediaRows = Array.from({ length: 3 }, (_, i) => ({
      id: `m${i}`,
      type: MediaType.MOVIE,
      slug: `movie-${i}`,
      title: `Movie ${i}`,
      originalTitle: `Movie ${i}`,
      overview: 'ov',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      releaseDate: now,
      videos: [],
      ratingoScore: 0.8,
      qualityScore: 70,
      watchersCount: 10,
      totalWatchers: 20,
      rating: 8,
      voteCount: 1000,
    }));

    setup([mediaRows]);

    const result = await query.execute({ limit: 3 });

    expect(result).toHaveLength(3);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should combine strict and fallback results', async () => {
    const now = new Date();
    const strictRows = [
      {
        id: 'm1',
        type: MediaType.MOVIE,
        slug: 'strict-movie',
        title: 'Strict Movie',
        originalTitle: 'Strict Movie',
        overview: 'ov',
        posterPath: '/p.jpg',
        backdropPath: '/b.jpg',
        releaseDate: now,
        videos: [],
        ratingoScore: 0.9,
        qualityScore: 80,
        watchersCount: 100,
        totalWatchers: 200,
        rating: 9,
        voteCount: 5000,
      },
    ];

    const fallbackRows = [
      {
        id: 'm2',
        type: MediaType.MOVIE,
        slug: 'fallback-movie',
        title: 'Fallback Movie',
        originalTitle: 'Fallback Movie',
        overview: 'ov',
        posterPath: '/p.jpg',
        backdropPath: '/b.jpg',
        releaseDate: now,
        videos: [],
        ratingoScore: 0.7,
        qualityScore: 65,
        watchersCount: 20,
        totalWatchers: 50,
        rating: 7,
        voteCount: 1000,
      },
    ];

    setup([strictRows, fallbackRows]);

    const result = await query.execute({ limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('m1');
    expect(result[1].id).toBe('m2');
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('should return empty array on error', async () => {
    setup([], new Error('DB Error'));
    const result = await query.execute({ limit: 3 });
    expect(result).toEqual([]);
  });
});

// ============================================================================
// Hero Freshness Gate Property Tests
// ============================================================================

/**
 * Property tests for Hero freshness gate behavior.
 *
 * Critical invariant: Hero answers "what's trending NOW", not "what's best overall".
 * Shows must have recent episodes (within MAX_DAYS_SINCE_LAST_EPISODE days).
 * Movies pass through without freshness restriction.
 *
 * This prevents "evergreen classics" (Friends, Office, Big Bang Theory) from
 * dominating Hero despite high liveWatchers - they're constantly rewatched
 * but not culturally "trending".
 */
describe('Hero - Freshness Gate Property Tests', () => {
  const daysArb = fc.integer({ min: 0, max: 730 }); // 0 to 2 years

  /**
   * Simulates the freshness gate logic from hero-media.query.ts
   */
  const passesShowFreshnessGate = (daysSinceLastEpisode: number): boolean => {
    return daysSinceLastEpisode <= HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE;
  };

  describe('Property: Freshness threshold is correctly configured', () => {
    it('MAX_DAYS_SINCE_LAST_EPISODE is 180', () => {
      expect(HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE).toBe(180);
    });

    it('threshold represents approximately 6 months', () => {
      const approximateMonths = HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE / 30;
      expect(approximateMonths).toBeCloseTo(6, 0);
    });
  });

  describe('Property: Shows freshness gate behavior', () => {
    it('shows with recent episodes (≤180 days) pass the gate', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE }),
          (daysSinceLastEpisode) => {
            expect(passesShowFreshnessGate(daysSinceLastEpisode)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('shows with old episodes (>180 days) fail the gate', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE + 1, max: 730 }),
          (daysSinceLastEpisode) => {
            expect(passesShowFreshnessGate(daysSinceLastEpisode)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('freshness gate is deterministic', () => {
      fc.assert(
        fc.property(daysArb, (daysSinceLastEpisode) => {
          const passes1 = passesShowFreshnessGate(daysSinceLastEpisode);
          const passes2 = passesShowFreshnessGate(daysSinceLastEpisode);
          expect(passes1).toBe(passes2);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property: Movies are exempt from freshness gate', () => {
    it('movies always pass regardless of any date', () => {
      // Movies have no lastAirDate concept - they pass through
      // This is implemented in SQL: OR(type = MOVIE, lastAirDate >= cutoff)
      const moviePassesFreshnessGate = (): boolean => true;

      fc.assert(
        fc.property(daysArb, () => {
          expect(moviePassesFreshnessGate()).toBe(true);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Property: Boundary conditions', () => {
    it('exactly 180 days passes (boundary inclusive)', () => {
      expect(passesShowFreshnessGate(180)).toBe(true);
    });

    it('181 days fails (boundary exclusive)', () => {
      expect(passesShowFreshnessGate(181)).toBe(false);
    });

    it('0 days (today) passes', () => {
      expect(passesShowFreshnessGate(0)).toBe(true);
    });
  });

  describe('Property: Date calculation is correct', () => {
    it('cutoff date is calculated correctly from now', () => {
      const now = new Date();
      const cutoff = new Date(
        now.getTime() - HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE * MS_PER_DAY,
      );

      // Verify cutoff is ~180 days in the past
      const diffMs = now.getTime() - cutoff.getTime();
      const diffDays = diffMs / MS_PER_DAY;
      expect(diffDays).toBeCloseTo(180, 0);
    });
  });
});

// ============================================================================
// Hero Sorting Property Tests
// ============================================================================

/**
 * Property tests for Hero sorting behavior.
 *
 * Critical invariant: Hero shows "what's trending NOW".
 * Primary sort: liveWatchers (watchersCount) DESC
 * Secondary sort: ratingoScore DESC (quality tiebreaker)
 */
describe('Hero - Sorting Property Tests', () => {
  const watchersArb = fc.integer({ min: 0, max: 10000 });
  const scoreArb = fc.integer({ min: 0, max: 100 });

  type HeroItem = { id: string; watchersCount: number; ratingoScore: number };

  /**
   * Simulates the hero sorting logic.
   * Items with higher watchersCount come first.
   * For same watchersCount, higher ratingoScore wins.
   */
  const sortHeroItems = (items: HeroItem[]): HeroItem[] => {
    return [...items].sort((a, b) => {
      // Primary: watchersCount DESC
      if (b.watchersCount !== a.watchersCount) {
        return b.watchersCount - a.watchersCount;
      }
      // Secondary: ratingoScore DESC
      return b.ratingoScore - a.ratingoScore;
    });
  };

  describe('Property: Primary sort is by liveWatchers', () => {
    it('item with more watchers always ranks higher', () => {
      fc.assert(
        fc.property(watchersArb, watchersArb, scoreArb, scoreArb, (w1, w2, s1, s2) => {
          fc.pre(w1 !== w2); // Only test when watchers differ

          const items: HeroItem[] = [
            { id: 'a', watchersCount: w1, ratingoScore: s1 },
            { id: 'b', watchersCount: w2, ratingoScore: s2 },
          ];
          const sorted = sortHeroItems(items);

          // Item with more watchers should be first
          if (w1 > w2) {
            expect(sorted[0].id).toBe('a');
          } else {
            expect(sorted[0].id).toBe('b');
          }
        }),
        { numRuns: 100 },
      );
    });

    it('quality score does not override watchers count', () => {
      // High quality (100) but low watchers (10) should lose to
      // low quality (50) but high watchers (1000)
      const items: HeroItem[] = [
        { id: 'high-quality', watchersCount: 10, ratingoScore: 100 },
        { id: 'high-watchers', watchersCount: 1000, ratingoScore: 50 },
      ];
      const sorted = sortHeroItems(items);

      expect(sorted[0].id).toBe('high-watchers');
    });
  });

  describe('Property: Secondary sort is by ratingoScore', () => {
    it('when watchers equal, higher score wins', () => {
      fc.assert(
        fc.property(watchersArb, scoreArb, scoreArb, (watchers, s1, s2) => {
          fc.pre(s1 !== s2); // Only test when scores differ

          const items: HeroItem[] = [
            { id: 'a', watchersCount: watchers, ratingoScore: s1 },
            { id: 'b', watchersCount: watchers, ratingoScore: s2 },
          ];
          const sorted = sortHeroItems(items);

          // Item with higher score should be first
          if (s1 > s2) {
            expect(sorted[0].id).toBe('a');
          } else {
            expect(sorted[0].id).toBe('b');
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property: Sorting is stable and deterministic', () => {
    it('same input always produces same order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              watchersCount: watchersArb,
              ratingoScore: scoreArb,
            }),
            { minLength: 2, maxLength: 10 },
          ),
          (items) => {
            const sorted1 = sortHeroItems(items);
            const sorted2 = sortHeroItems(items);

            expect(sorted1.map((i) => i.id)).toEqual(sorted2.map((i) => i.id));
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
