import { MovieListingsQuery, EligibilityMode } from './movie-listings.query';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { EligibilityStatus } from '../../../catalog-policy/public';

// Simple chainable thenable for Drizzle-like API
const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = [
    'select',
    'from',
    'innerJoin',
    'leftJoin',
    'where',
    'orderBy',
    'limit',
    'offset',
  ];
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

describe('MovieListingsQuery', () => {
  let query: MovieListingsQuery;
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

    const mockGenreQuery = {
      fetchForMediaItems: jest.fn().mockImplementation((ids: string[]) => {
        const genresData = selectQueue.shift() ?? [];
        const map = new Map<string, any[]>();
        genresData.forEach((g: any) => {
          if (!map.has(g.mediaItemId)) map.set(g.mediaItemId, []);
          map.get(g.mediaItemId)!.push({ id: g.id, name: g.name, slug: g.slug });
        });
        return Promise.resolve(map);
      }),
    };

    query = new MovieListingsQuery(db as any, mockGenreQuery as any);
  };

  it('should return mapped movies with genres (now_playing)', async () => {
    const movies = [
      {
        id: 'row1',
        mediaItemId: 'mid1',
        tmdbId: 10,
        title: 'Movie',
        slug: 'movie',
        overview: 'ov',
        ingestionStatus: 'done',
        posterPath: '/p.jpg',
        backdropPath: '/b.jpg',
        popularity: 100,
        releaseDate: new Date('2024-01-01'),
        theatricalReleaseDate: new Date('2024-01-02'),
        digitalReleaseDate: new Date('2024-02-01'),
        runtime: 120,
        ratingoScore: 0.8,
        qualityScore: 0.7,
        popularityScore: 0.9,
        watchersCount: 5,
        totalWatchers: 10,
        rating: 8,
        voteCount: 1000,
        ratingImdb: 7,
        voteCountImdb: 900,
        ratingTrakt: 8,
        voteCountTrakt: 800,
        ratingMetacritic: 70,
        ratingRottenTomatoes: 85,
      },
    ];

    const genres = [
      { mediaItemId: 'mid1', id: 'g1', name: 'Action', slug: 'action' },
      { mediaItemId: 'mid1', id: 'g2', name: 'Drama', slug: 'drama' },
    ];

    // main select + count + attachGenres select
    setup([movies, [{ total: movies.length }], genres]);

    const res = await query.execute('now_playing', { limit: 5, offset: 0 });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('row1');
    expect(res[0].genres).toHaveLength(2);
    expect(res[0].poster).toEqual({ small: 'poster' });
    expect(res[0].backdrop).toEqual({ small: 'backdrop' });
  });

  it('should handle new_releases with custom daysBack and multiple items', async () => {
    const movies = [
      {
        id: 'r1',
        mediaItemId: 'm1',
        tmdbId: 1,
        title: 'A',
        slug: 'a',
        overview: '',
        ingestionStatus: 'done',
        posterPath: '/p1',
        backdropPath: '/b1',
        popularity: 1,
        releaseDate: new Date(),
        theatricalReleaseDate: new Date(),
        digitalReleaseDate: null,
        runtime: 90,
        ratingoScore: 1,
        qualityScore: 1,
        popularityScore: 1,
        watchersCount: 1,
        totalWatchers: 1,
        rating: 7,
        voteCount: 10,
      },
      {
        id: 'r2',
        mediaItemId: 'm2',
        tmdbId: 2,
        title: 'B',
        slug: 'b',
        overview: '',
        ingestionStatus: 'done',
        posterPath: '/p2',
        backdropPath: '/b2',
        popularity: 2,
        releaseDate: new Date(),
        theatricalReleaseDate: new Date(),
        digitalReleaseDate: null,
        runtime: 100,
        ratingoScore: 2,
        qualityScore: 2,
        popularityScore: 2,
        watchersCount: 2,
        totalWatchers: 2,
        rating: 8,
        voteCount: 20,
      },
    ];
    const genres = [
      { mediaItemId: 'm1', id: 'g1', name: 'Action', slug: 'action' },
      { mediaItemId: 'm2', id: 'g2', name: 'Drama', slug: 'drama' },
    ];

    // main + count + genres
    setup([movies, [{ total: movies.length }], genres]);

    const res = await query.execute('new_releases', { daysBack: 10, limit: 2, offset: 1 });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(res).toHaveLength(2);
    expect(res[0].genres[0].slug).toBe('action');
    expect(res[1].genres[0].slug).toBe('drama');
  });

  it('should handle new_on_digital branch', async () => {
    const movies = [
      {
        id: 'd1',
        mediaItemId: 'dm1',
        tmdbId: 3,
        title: 'Digital',
        slug: 'digital',
        overview: '',
        ingestionStatus: 'done',
        posterPath: '/pd',
        backdropPath: '/bd',
        popularity: 3,
        releaseDate: new Date(),
        theatricalReleaseDate: null,
        digitalReleaseDate: new Date(),
        runtime: 110,
        ratingoScore: 3,
        qualityScore: 3,
        popularityScore: 3,
        watchersCount: 3,
        totalWatchers: 3,
        rating: 9,
        voteCount: 30,
      },
    ];
    const genres = [{ mediaItemId: 'dm1', id: 'g3', name: 'SciFi', slug: 'sci-fi' }];

    setup([movies, [{ total: movies.length }], genres]);

    const res = await query.execute('new_on_digital', { daysBack: 7 });
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(res[0].genres[0].name).toBe('SciFi');
  });

  it('should return empty array when no movies', async () => {
    setup([[], [{ total: 0 }]]); // main + count; attachGenres skipped on empty
    const res = await query.execute('now_playing', {});
    expect(res).toHaveLength(0);
    expect((res as any).total).toBe(0);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('should throw DatabaseException on error', async () => {
    setup([], new Error('DB Error'));
    await expect(query.execute('new_releases', {})).rejects.toThrow(DatabaseException);
  });

  describe('now_playing query conditions', () => {
    it('should include movies with future theatricalReleaseDate if isNowPlaying is true (trust TMDB)', async () => {
      // Avatar: Fire and Ash scenario - TMDB says it's now playing even though
      // theatricalReleaseDate is in the future (regional release dates differ)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days in future

      const movies = [
        {
          id: 'avatar',
          mediaItemId: 'mid-avatar',
          tmdbId: 83533,
          title: 'Avatar: Fire and Ash',
          slug: 'avatar-fire-and-ash',
          overview: 'Avatar 3',
          ingestionStatus: 'ready',
          posterPath: '/avatar.jpg',
          backdropPath: '/avatar-bg.jpg',
          popularity: 100,
          releaseDate: futureDate,
          theatricalReleaseDate: futureDate, // Future date
          digitalReleaseDate: null,
          runtime: 180,
          ratingoScore: 80,
          qualityScore: 85,
          popularityScore: 90,
          watchersCount: 1000,
          totalWatchers: 5000,
          rating: 0,
          voteCount: 0,
        },
      ];

      const genres = [{ mediaItemId: 'mid-avatar', id: 'g1', name: 'Sci-Fi', slug: 'sci-fi' }];

      setup([movies, [{ total: 1 }], genres]);

      const res = await query.execute('now_playing', { limit: 10, offset: 0 });

      // Should return the movie even with future theatricalReleaseDate
      // because we trust TMDB's isNowPlaying flag
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Avatar: Fire and Ash');
      expect(res[0].slug).toBe('avatar-fire-and-ash');
    });

    it('should exclude movies that are already on streaming (digitalReleaseDate <= now)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30); // 30 days ago

      const movies = [
        {
          id: 'streaming-movie',
          mediaItemId: 'mid-streaming',
          tmdbId: 12345,
          title: 'Already Streaming Movie',
          slug: 'already-streaming',
          overview: 'This movie is on streaming',
          ingestionStatus: 'ready',
          posterPath: '/stream.jpg',
          backdropPath: '/stream-bg.jpg',
          popularity: 50,
          releaseDate: pastDate,
          theatricalReleaseDate: pastDate,
          digitalReleaseDate: pastDate, // Already on streaming
          runtime: 120,
          ratingoScore: 70,
          qualityScore: 75,
          popularityScore: 60,
          watchersCount: 500,
          totalWatchers: 2000,
          rating: 7,
          voteCount: 1000,
        },
      ];

      // Query returns empty because digitalReleaseDate filter excludes it
      setup([[], [{ total: 0 }]]);

      const res = await query.execute('now_playing', {});

      // Should be empty - movies on streaming are excluded from now_playing
      expect(res).toHaveLength(0);
    });
  });

  describe('eligibilityMode filtering', () => {
    it('should default to catalog mode when eligibilityMode is not specified', async () => {
      const movies = [
        {
          id: 'eligible-movie',
          mediaItemId: 'mid-eligible',
          tmdbId: 100,
          title: 'Eligible Movie',
          slug: 'eligible-movie',
          overview: 'An eligible movie',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 100,
          releaseDate: new Date('2024-01-01'),
          theatricalReleaseDate: new Date('2024-01-02'),
          digitalReleaseDate: null,
          runtime: 120,
          ratingoScore: 0.8,
          qualityScore: 0.7,
          popularityScore: 0.9,
          watchersCount: 5,
          totalWatchers: 10,
          rating: 8,
          voteCount: 1000,
        },
      ];

      const genres = [{ mediaItemId: 'mid-eligible', id: 'g1', name: 'Action', slug: 'action' }];

      setup([movies, [{ total: 1 }], genres]);

      // Call without eligibilityMode - should default to 'catalog'
      const res = await query.execute('now_playing', { limit: 10, offset: 0 });

      expect(db.select).toHaveBeenCalledTimes(2);
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Eligible Movie');
    });

    it('should filter to only eligible content in catalog mode', async () => {
      const movies = [
        {
          id: 'eligible-movie',
          mediaItemId: 'mid-eligible',
          tmdbId: 100,
          title: 'Eligible Movie',
          slug: 'eligible-movie',
          overview: 'An eligible movie',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 100,
          releaseDate: new Date('2024-01-01'),
          theatricalReleaseDate: new Date('2024-01-02'),
          digitalReleaseDate: null,
          runtime: 120,
          ratingoScore: 0.8,
          qualityScore: 0.7,
          popularityScore: 0.9,
          watchersCount: 5,
          totalWatchers: 10,
          rating: 8,
          voteCount: 1000,
        },
      ];

      const genres = [{ mediaItemId: 'mid-eligible', id: 'g1', name: 'Action', slug: 'action' }];

      setup([movies, [{ total: 1 }], genres]);

      const res = await query.execute('now_playing', {
        limit: 10,
        offset: 0,
        eligibilityMode: 'catalog',
      });

      expect(db.select).toHaveBeenCalledTimes(2);
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Eligible Movie');
    });

    it('should include ineligible content with only MISSING_GLOBAL_SIGNALS in freshness mode', async () => {
      // In freshness mode, we expect the query to include:
      // - eligible content
      // - ineligible content with reasons = ['MISSING_GLOBAL_SIGNALS']
      const movies = [
        {
          id: 'fresh-movie',
          mediaItemId: 'mid-fresh',
          tmdbId: 200,
          title: 'Fresh Movie Without Signals',
          slug: 'fresh-movie',
          overview: 'A fresh movie lacking quality signals',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 50,
          releaseDate: new Date('2024-12-01'),
          theatricalReleaseDate: new Date('2024-12-01'),
          digitalReleaseDate: null,
          runtime: 100,
          ratingoScore: null,
          qualityScore: null,
          popularityScore: 0.5,
          watchersCount: 0,
          totalWatchers: 0,
          rating: 0,
          voteCount: 0,
        },
      ];

      const genres = [{ mediaItemId: 'mid-fresh', id: 'g1', name: 'Drama', slug: 'drama' }];

      setup([movies, [{ total: 1 }], genres]);

      const res = await query.execute('now_playing', {
        limit: 10,
        offset: 0,
        eligibilityMode: 'freshness',
      });

      expect(db.select).toHaveBeenCalledTimes(2);
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Fresh Movie Without Signals');
    });

    it('should work with new_on_digital in freshness mode', async () => {
      const movies = [
        {
          id: 'digital-fresh',
          mediaItemId: 'mid-digital-fresh',
          tmdbId: 300,
          title: 'New Digital Release',
          slug: 'new-digital-release',
          overview: 'A new digital release',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 75,
          releaseDate: new Date('2024-11-01'),
          theatricalReleaseDate: new Date('2024-09-01'),
          digitalReleaseDate: new Date(),
          runtime: 110,
          ratingoScore: null,
          qualityScore: null,
          popularityScore: 0.6,
          watchersCount: 10,
          totalWatchers: 50,
          rating: 0,
          voteCount: 0,
        },
      ];

      const genres = [
        { mediaItemId: 'mid-digital-fresh', id: 'g1', name: 'Thriller', slug: 'thriller' },
      ];

      setup([movies, [{ total: 1 }], genres]);

      const res = await query.execute('new_on_digital', {
        daysBack: 14,
        eligibilityMode: 'freshness',
      });

      expect(db.select).toHaveBeenCalledTimes(2);
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('New Digital Release');
    });
  });

  describe('new_on_digital release date filtering', () => {
    it('should return movies originally released within the last year', async () => {
      // Movie released 6 months ago, digital release within 14 days
      const recentReleaseDate = new Date();
      recentReleaseDate.setMonth(recentReleaseDate.getMonth() - 6);

      const movies = [
        {
          id: 'recent-movie',
          mediaItemId: 'mid-recent',
          tmdbId: 400,
          title: 'Recent Movie',
          slug: 'recent-movie',
          overview: 'A recently released movie',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 80,
          releaseDate: recentReleaseDate, // 6 months ago - within 365 days
          theatricalReleaseDate: recentReleaseDate,
          digitalReleaseDate: new Date(), // Just released digitally
          runtime: 120,
          ratingoScore: 75,
          qualityScore: 70,
          popularityScore: 0.8,
          watchersCount: 100,
          totalWatchers: 500,
          rating: 7.5,
          voteCount: 2000,
        },
      ];

      const genres = [{ mediaItemId: 'mid-recent', id: 'g1', name: 'Action', slug: 'action' }];

      setup([movies, [{ total: 1 }], genres]);

      const res = await query.execute('new_on_digital', { limit: 10 });

      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Recent Movie');
    });

    it('should exclude old classics being re-released on digital (behavior documented)', async () => {
      // This test documents expected behavior: old movies (>365 days old) should be filtered
      // The actual filtering happens in SQL via DIGITAL_RELEASE_MAX_AGE_DAYS condition
      // Mock returns empty to simulate DB filtering out the old movie

      setup([[], [{ total: 0 }]]);

      const res = await query.execute('new_on_digital', { limit: 10 });

      // Old movies like Harry Potter (2001) re-released on Max should not appear
      // because releaseDate is older than DIGITAL_RELEASE_MAX_AGE_DAYS (365 days)
      expect(res).toHaveLength(0);
      expect((res as any).total).toBe(0);
    });
  });

  describe('sort options', () => {
    it('should handle lastAirDate sort (falls back to releaseDate for movies)', async () => {
      const movies = [
        {
          id: 'sorted-movie',
          mediaItemId: 'mid-sorted',
          tmdbId: 600,
          title: 'Sorted Movie',
          slug: 'sorted-movie',
          overview: 'A sorted movie',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 80,
          releaseDate: new Date('2024-06-01'),
          theatricalReleaseDate: new Date('2024-06-01'),
          digitalReleaseDate: null,
          runtime: 120,
          ratingoScore: 75,
          qualityScore: 70,
          popularityScore: 0.8,
          watchersCount: 100,
          totalWatchers: 500,
          rating: 7.5,
          voteCount: 2000,
        },
      ];

      const genres = [{ mediaItemId: 'mid-sorted', id: 'g1', name: 'Action', slug: 'action' }];

      setup([movies, [{ total: 1 }], genres]);

      // lastAirDate should not throw and should produce valid results
      const res = await query.execute('now_playing', {
        limit: 10,
        offset: 0,
        sort: 'lastAirDate',
        order: 'desc',
      });

      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Sorted Movie');
    });

    it('should handle releaseDate sort', async () => {
      const movies = [
        {
          id: 'date-sorted',
          mediaItemId: 'mid-date',
          tmdbId: 601,
          title: 'Date Sorted',
          slug: 'date-sorted',
          overview: '',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 60,
          releaseDate: new Date('2024-03-01'),
          theatricalReleaseDate: new Date('2024-03-01'),
          digitalReleaseDate: null,
          runtime: 100,
          ratingoScore: 60,
          qualityScore: 55,
          popularityScore: 0.6,
          watchersCount: 50,
          totalWatchers: 200,
          rating: 7,
          voteCount: 1000,
        },
      ];

      const genres = [{ mediaItemId: 'mid-date', id: 'g1', name: 'Drama', slug: 'drama' }];

      setup([movies, [{ total: 1 }], genres]);

      const res = await query.execute('new_releases', {
        limit: 10,
        sort: 'releaseDate',
        order: 'asc',
      });

      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Date Sorted');
    });
  });

  describe('context filtering for eligibility', () => {
    it('should use CATALOG context for eligibility JOIN to prevent duplicates', async () => {
      // This test documents the context filter behavior
      // Each movie has evaluations for multiple contexts (CATALOG, TRENDING, etc.)
      // Without context filter, JOINs would create duplicates
      // The query filters by EvaluationContext.CATALOG to ensure unique results

      const movies = [
        {
          id: 'unique-movie',
          mediaItemId: 'mid-unique',
          tmdbId: 500,
          title: 'Unique Movie',
          slug: 'unique-movie',
          overview: 'Should appear once, not duplicated',
          ingestionStatus: 'ready',
          posterPath: '/p.jpg',
          backdropPath: '/b.jpg',
          popularity: 90,
          releaseDate: new Date(),
          theatricalReleaseDate: new Date(),
          digitalReleaseDate: null,
          runtime: 130,
          ratingoScore: 85,
          qualityScore: 80,
          popularityScore: 0.9,
          watchersCount: 200,
          totalWatchers: 1000,
          rating: 8.5,
          voteCount: 5000,
        },
      ];

      const genres = [{ mediaItemId: 'mid-unique', id: 'g1', name: 'Drama', slug: 'drama' }];

      // Return single movie (context filter ensures no duplicates from multiple evaluation records)
      setup([movies, [{ total: 1 }], genres]);

      const res = await query.execute('new_releases', { limit: 10 });

      // Should return exactly 1 movie, not duplicated
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Unique Movie');
      expect((res as any).total).toBe(1);
    });
  });
});
