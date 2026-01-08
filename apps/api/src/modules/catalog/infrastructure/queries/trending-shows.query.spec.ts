import { TrendingShowsQuery } from './trending-shows.query';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

const dateFrom = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
};

// Chainable thenable for Drizzle-like API (for select queries)
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

describe('TrendingShowsQuery', () => {
  let db: any;
  let query: TrendingShowsQuery;

  beforeEach(() => {
    jest.spyOn(ImageMapper, 'toPoster').mockReturnValue({ small: 'poster' } as any);
    jest.spyOn(ImageMapper, 'toBackdrop').mockReturnValue({ small: 'backdrop' } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = (contextCheckResult: any[], executeResults: any[][]) => {
    let executeCallIndex = 0;
    db = {
      select: jest.fn().mockReturnValue(createThenable(contextCheckResult)),
      execute: jest.fn().mockImplementation(() => {
        const result = executeResults[executeCallIndex] ?? [];
        executeCallIndex++;
        return Promise.resolve(result);
      }),
    };
    query = new TrendingShowsQuery(db as any);
  };

  it('should map trending shows with progress and flags', async () => {
    const rows = [
      {
        id: 'm1',
        tmdb_id: 1,
        title: 'Show',
        original_title: 'Orig',
        slug: 'show',
        overview: 'ov',
        poster_path: '/p.jpg',
        backdrop_path: '/b.jpg',
        release_date: dateFrom(-5),
        videos: [{ key: 'trailer1' }],
        ingestion_status: 'done',
        rating: 8,
        vote_count: 1000,
        rating_imdb: 7,
        vote_count_imdb: 900,
        rating_trakt: 8,
        vote_count_trakt: 800,
        rating_metacritic: 70,
        rating_rotten_tomatoes: 85,
        popularity: 50,
        ratingo_score: 90,
        quality_score: 0.8,
        popularity_score: 0.9,
        watchers_count: 5,
        total_watchers: 20000,
        last_air_date: dateFrom(-1),
        next_air_date: dateFrom(10),
        season_number: 3,
        episode_number: 5,
      },
      {
        id: 'm2',
        tmdb_id: 2,
        title: 'Old Show',
        original_title: null,
        slug: 'old',
        overview: null,
        poster_path: '/p2.jpg',
        backdrop_path: '/b2.jpg',
        release_date: new Date(new Date().getFullYear() - 12, 0, 1),
        videos: [],
        ingestion_status: 'done',
        rating: 7,
        vote_count: 500,
        ratingo_score: 60,
        quality_score: 0.6,
        popularity_score: 0.5,
        watchers_count: 1,
        total_watchers: 100,
        last_air_date: null,
        next_air_date: null,
        season_number: null,
        episode_number: null,
      },
    ];

    // context check (evaluations exist) + main query + count query
    setup([{ count: 1 }], [rows, [{ total: rows.length }]]);

    const result = await query.execute({ limit: 10, offset: 0, minRatingo: 50 });

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result.meta).toEqual({ degraded: false });

    const first = result.find((r) => r.id === 'm1')!;
    expect(first.isNew).toBe(true);
    expect(first.isClassic).toBe(true); // ratingoScore + watchers triggers classic
    expect(first.primaryTrailerKey).toBe('trailer1');
    expect(first.showProgress?.label).toBe('S3E5');
    expect(first.poster).toEqual({ small: 'poster' });

    const second = result.find((r) => r.id === 'm2')!;
    expect(second.isClassic).toBe(true);
    expect(second.showProgress?.label).toBeNull();
  });

  it('should return empty array when no results', async () => {
    // context check (evaluations exist) + main query + count query
    setup([{ count: 1 }], [[], [{ total: 0 }]]);
    const res = await query.execute({});
    expect(res).toHaveLength(0);
    expect((res as any).total).toBe(0);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(res.meta).toEqual({ degraded: false });
  });

  it('should return degraded state when no evaluations exist', async () => {
    // context check returns 0 evaluations
    setup([{ count: 0 }], []);
    const res = await query.execute({});
    expect(res).toHaveLength(0);
    expect(res.total).toBe(0);
    expect(res.meta).toEqual({
      degraded: true,
      degradedReason: 'Context evaluations missing - evaluation in progress',
    });
    // Only the context check query should be called
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('should throw DatabaseException on error', async () => {
    db = {
      select: jest.fn().mockReturnValue(createThenable([], new Error('DB error'))),
      execute: jest.fn(),
    };
    query = new TrendingShowsQuery(db as any);
    await expect(query.execute({})).rejects.toThrow(DatabaseException);
  });
});
