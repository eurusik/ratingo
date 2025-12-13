import { TrendingMoviesQuery } from './trending-movies.query';
import { ImageMapper } from '../mappers/image.mapper';
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

describe('TrendingMoviesQuery', () => {
  let query: TrendingMoviesQuery;
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

    query = new TrendingMoviesQuery(db as any);
  };

  it('should return mapped trending movies with genres and flags', async () => {
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
        title: 'Old Movie',
        slug: 'old',
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
        totalWatchers: 100,
        rating: 7,
        voteCount: 500,
      },
    ];

    const genres = [
      { mediaItemId: 'mid1', id: 'g1', name: 'Action', slug: 'action' },
      { mediaItemId: 'mid2', id: 'g2', name: 'Drama', slug: 'drama' },
    ];

    // main select + count + attachGenres
    setup([movies, [{ total: movies.length }], genres]);

    const res = await query.execute({ limit: 5, offset: 0, minRatingo: 50 });

    expect(db.select).toHaveBeenCalledTimes(3);
    expect(res).toHaveLength(2);

    const newMovie = res.find((m) => m.id === 'row1')!;
    expect(newMovie.isNew).toBe(true);
    expect(newMovie.isClassic).toBe(true); // ratingoScore high + watchers trigger classic
    expect(newMovie.genres).toHaveLength(1);
    expect(newMovie.poster).toEqual({ small: 'poster' });

    const oldMovie = res.find((m) => m.id === 'row2')!;
    expect(oldMovie.isClassic).toBe(true);
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
      },
    ] as any[];
    const genres = [{ mediaItemId: 'mid', id: 'g1', name: 'Action', slug: 'action' }];

    // select for genre subquery, main results, count, attachGenres
    setup([[{ id: 'mg' }], movies, [{ total: movies.length }], genres]);

    const res = await query.execute({ limit: 1, offset: 0, genres: ['g1'] });
    expect(db.select).toHaveBeenCalledTimes(4);
    expect(res).toHaveLength(1);
    expect(res[0].genres).toHaveLength(1);
  });

  it('should return empty array when no movies', async () => {
    setup([[], [{ total: 0 }]]); // main + count (attachGenres skipped)
    const res = await query.execute({});
    expect(res).toHaveLength(0);
    expect((res as any).total).toBe(0);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('should throw DatabaseException on error', async () => {
    setup([], new Error('DB Error'));
    await expect(query.execute({})).rejects.toThrow(DatabaseException);
  });
});
