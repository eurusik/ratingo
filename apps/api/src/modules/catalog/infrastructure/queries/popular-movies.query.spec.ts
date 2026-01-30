import { PopularMoviesQuery } from './popular-movies.query';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

// Chainable thenable for Drizzle-like API
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

describe('PopularMoviesQuery', () => {
  let query: PopularMoviesQuery;
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

    query = new PopularMoviesQuery(db as any, mockGenreQuery as any);
  };

  it('should return mapped popular movies with genres and flags', async () => {
    const now = new Date();
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
        releaseDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // new
        theatricalReleaseDate: new Date('2024-01-02'),
        digitalReleaseDate: new Date('2024-02-01'),
        runtime: 120,
        ratingoScore: 85,
        qualityScore: 0.7,
        popularityScore: 0.9,
        watchersCount: 5,
        totalWatchers: 20000,
        rating: 8,
        voteCount: 1000,
        ratingImdb: 7,
        voteCountImdb: 900,
        ratingTrakt: 8,
        voteCountTrakt: 800,
        ratingMetacritic: 70,
        ratingRottenTomatoes: 85,
      },
      {
        id: 'row2',
        mediaItemId: 'mid2',
        tmdbId: 11,
        title: 'Classic Movie',
        slug: 'classic',
        overview: 'ov2',
        ingestionStatus: 'done',
        posterPath: '/p2.jpg',
        backdropPath: '/b2.jpg',
        popularity: 50,
        releaseDate: new Date(now.getFullYear() - 15, 0, 1), // classic by date
        theatricalReleaseDate: new Date('2010-01-02'),
        digitalReleaseDate: new Date('2010-02-01'),
        runtime: 90,
        ratingoScore: 70,
        qualityScore: 0.6,
        popularityScore: 0.5,
        watchersCount: 1,
        totalWatchers: 15000, // Passes popular threshold
        rating: 7,
        voteCount: 500,
      },
    ];

    const genres = [
      { mediaItemId: 'mid1', id: 'g1', name: 'Action', slug: 'action' },
      { mediaItemId: 'mid2', id: 'g2', name: 'Drama', slug: 'drama' },
    ];

    // context check (evaluations exist) + main select + count (genres fetched via mockGenreQuery)
    setup([[{ count: 1 }], movies, [{ total: movies.length }], genres]);

    const res = await query.execute({ limit: 5, offset: 0, minRatingo: 50 });

    expect(db.select).toHaveBeenCalledTimes(3);
    expect(res).toHaveLength(2);
    expect(res.meta).toEqual({ degraded: false });

    const newMovie = res.find((m) => m.id === 'row1')!;
    expect(newMovie.isNew).toBe(true);
    expect(newMovie.isClassic).toBe(true); // ratingoScore high + watchers trigger classic
    expect(newMovie.genres).toHaveLength(1);
    expect(newMovie.poster).toEqual({ small: 'poster' });

    const classicMovie = res.find((m) => m.id === 'row2')!;
    expect(classicMovie.isClassic).toBe(true);
  });

  it('should apply genre filter (subquery) and map results', async () => {
    const movies = [
      {
        id: 'row',
        mediaItemId: 'mid',
        tmdbId: 1,
        title: 'T',
        slug: 't',
        overview: '',
        ingestionStatus: 'done',
        posterPath: '/p',
        backdropPath: '/b',
        popularity: 1,
        releaseDate: new Date(),
        ratingoScore: 10,
        totalWatchers: 10000,
      },
    ] as any[];
    const genres = [{ mediaItemId: 'mid', id: 'g1', name: 'Action', slug: 'action' }];

    // context check + select for genre subquery + main results + count (genres fetched via mockGenreQuery)
    setup([[{ count: 1 }], [{ id: 'mg' }], movies, [{ total: movies.length }], genres]);

    const res = await query.execute({ limit: 1, offset: 0, genres: ['g1'] });
    expect(db.select).toHaveBeenCalledTimes(4);
    expect(res).toHaveLength(1);
    expect(res[0].genres).toHaveLength(1);
    expect(res.meta).toEqual({ degraded: false });
  });

  it('should return empty array when no movies', async () => {
    // context check (evaluations exist) + main + count (attachGenres skipped)
    setup([[{ count: 1 }], [], [{ total: 0 }]]);
    const res = await query.execute({});
    expect(res).toHaveLength(0);
    expect((res as any).total).toBe(0);
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(res.meta).toEqual({ degraded: false });
  });

  it('should return degraded state when no evaluations exist for CATALOG context', async () => {
    // context check returns 0 evaluations
    setup([[{ count: 0 }]]);
    const res = await query.execute({});
    expect(res).toHaveLength(0);
    expect(res.total).toBe(0);
    expect(res.meta).toEqual({
      degraded: true,
      degradedReason: 'Context evaluations missing - evaluation in progress',
    });
    // Only the context check query should be called
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should use popularity as default sort', async () => {
    const movies = [
      {
        id: 'row1',
        mediaItemId: 'mid1',
        tmdbId: 1,
        title: 'Popular',
        slug: 'popular',
        overview: '',
        ingestionStatus: 'done',
        posterPath: '/p',
        backdropPath: '/b',
        popularity: 100,
        releaseDate: new Date(),
        popularityScore: 0.9,
        totalWatchers: 10000,
      },
    ] as any[];

    setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

    // Default sort should be popularity
    const res = await query.execute({});
    expect(res).toHaveLength(1);
    expect(res.meta).toEqual({ degraded: false });
  });

  it('should throw DatabaseException on error', async () => {
    setup([], new Error('DB Error'));
    await expect(query.execute({})).rejects.toThrow(DatabaseException);
  });

  describe('year filtering', () => {
    const createMovieWithDate = (id: string, releaseDate: Date) => ({
      id,
      mediaItemId: `mid-${id}`,
      tmdbId: parseInt(id),
      title: `Movie ${id}`,
      slug: `movie-${id}`,
      overview: '',
      ingestionStatus: 'done',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      popularity: 50,
      releaseDate,
      totalWatchers: 10000,
    });

    it('should filter by exact year', async () => {
      const movies = [createMovieWithDate('1', new Date('2023-06-15'))];
      setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

      const res = await query.execute({ year: 2023 });

      expect(res).toHaveLength(1);
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter by yearFrom (inclusive)', async () => {
      const movies = [
        createMovieWithDate('1', new Date('2022-01-01')),
        createMovieWithDate('2', new Date('2023-06-15')),
      ];
      setup([[{ count: 1 }], movies, [{ total: 2 }], []]);

      const res = await query.execute({ yearFrom: 2022 });

      expect(res).toHaveLength(2);
    });

    it('should filter by yearTo (inclusive)', async () => {
      const movies = [createMovieWithDate('1', new Date('2020-12-31'))];
      setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

      const res = await query.execute({ yearTo: 2020 });

      expect(res).toHaveLength(1);
    });

    it('should filter by year range (yearFrom and yearTo)', async () => {
      const movies = [
        createMovieWithDate('1', new Date('2020-01-01')),
        createMovieWithDate('2', new Date('2021-06-15')),
        createMovieWithDate('3', new Date('2022-12-31')),
      ];
      setup([[{ count: 1 }], movies, [{ total: 3 }], []]);

      const res = await query.execute({ yearFrom: 2020, yearTo: 2022 });

      expect(res).toHaveLength(3);
    });
  });

  describe('sort options', () => {
    const createMovie = (
      id: string,
      scores: Partial<{
        ratingoScore: number;
        popularityScore: number;
        releaseDate: Date;
        popularity: number;
      }> = {},
    ) => ({
      id,
      mediaItemId: `mid-${id}`,
      tmdbId: parseInt(id),
      title: `Movie ${id}`,
      slug: `movie-${id}`,
      overview: '',
      ingestionStatus: 'done',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      totalWatchers: 10000,
      ...scores,
    });

    it('should accept ratingo sort option', async () => {
      const movies = [
        createMovie('1', { ratingoScore: 90 }),
        createMovie('2', { ratingoScore: 70 }),
      ];
      setup([[{ count: 1 }], movies, [{ total: 2 }], []]);

      const res = await query.execute({ sort: 'ratingo', order: 'desc' });

      expect(res).toHaveLength(2);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept releaseDate sort option', async () => {
      const movies = [
        createMovie('1', { releaseDate: new Date('2024-01-01') }),
        createMovie('2', { releaseDate: new Date('2023-01-01') }),
      ];
      setup([[{ count: 1 }], movies, [{ total: 2 }], []]);

      const res = await query.execute({ sort: 'releaseDate', order: 'desc' });

      expect(res).toHaveLength(2);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept tmdbPopularity sort option', async () => {
      const movies = [createMovie('1', { popularity: 100 }), createMovie('2', { popularity: 50 })];
      setup([[{ count: 1 }], movies, [{ total: 2 }], []]);

      const res = await query.execute({ sort: 'tmdbPopularity', order: 'desc' });

      expect(res).toHaveLength(2);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept trending sort option', async () => {
      const movies = [createMovie('1', { ratingoScore: 80, popularityScore: 0.8 })];
      setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

      const res = await query.execute({ sort: 'trending' });

      expect(res).toHaveLength(1);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept ascending order', async () => {
      const movies = [createMovie('1', { ratingoScore: 50 })];
      setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

      const res = await query.execute({ sort: 'ratingo', order: 'asc' });

      expect(res).toHaveLength(1);
      expect(res.meta).toEqual({ degraded: false });
    });
  });

  describe('pagination', () => {
    it('should respect limit parameter', async () => {
      const movies = [
        { id: '1', mediaItemId: 'mid1', totalWatchers: 10000 },
        { id: '2', mediaItemId: 'mid2', totalWatchers: 10000 },
      ] as any[];
      setup([[{ count: 1 }], movies, [{ total: 10 }], []]);

      const res = await query.execute({ limit: 2 });

      expect(res).toHaveLength(2);
      expect(res.total).toBe(10);
    });

    it('should respect offset parameter', async () => {
      const movies = [{ id: '3', mediaItemId: 'mid3', totalWatchers: 10000 }] as any[];
      setup([[{ count: 1 }], movies, [{ total: 10 }], []]);

      const res = await query.execute({ limit: 1, offset: 2 });

      expect(res).toHaveLength(1);
      expect(res.total).toBe(10);
    });
  });

  describe('minRatingo filtering', () => {
    it('should filter by minimum ratingo score', async () => {
      const movies = [
        { id: '1', mediaItemId: 'mid1', ratingoScore: 80, totalWatchers: 10000 },
      ] as any[];
      setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

      const res = await query.execute({ minRatingo: 70 });

      expect(res).toHaveLength(1);
    });
  });

  describe('minVotes filtering', () => {
    it('should filter by minimum votes (TMDB)', async () => {
      const movies = [
        { id: '1', mediaItemId: 'mid1', voteCount: 1000, totalWatchers: 10000 },
      ] as any[];
      setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

      const res = await query.execute({ minVotes: 500, voteSource: 'tmdb' });

      expect(res).toHaveLength(1);
    });

    it('should filter by minimum votes (Trakt)', async () => {
      const movies = [
        { id: '1', mediaItemId: 'mid1', voteCountTrakt: 500, totalWatchers: 10000 },
      ] as any[];
      setup([[{ count: 1 }], movies, [{ total: 1 }], []]);

      const res = await query.execute({ minVotes: 100, voteSource: 'trakt' });

      expect(res).toHaveLength(1);
    });
  });
});
