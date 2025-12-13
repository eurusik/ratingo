import { MovieListingsQuery } from './movie-listings.query';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { ImageMapper } from '../mappers/image.mapper';

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

    query = new MovieListingsQuery(db as any);
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

    expect(db.select).toHaveBeenCalledTimes(3);
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

    expect(db.select).toHaveBeenCalledTimes(3);
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
    expect(db.select).toHaveBeenCalledTimes(3);
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
});
