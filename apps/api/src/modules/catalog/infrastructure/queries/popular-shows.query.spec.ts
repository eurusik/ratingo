import { PopularShowsQuery } from './popular-shows.query';
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

describe('PopularShowsQuery', () => {
  let db: any;
  let query: PopularShowsQuery;

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
    query = new PopularShowsQuery(db as any);
  };

  it('should map popular shows with progress and flags', async () => {
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
        total_watchers: 20000, // Passes popular threshold
        last_air_date: dateFrom(-1),
        next_air_date: dateFrom(10),
        season_number: 3,
        episode_number: 5,
      },
      {
        id: 'm2',
        tmdb_id: 2,
        title: 'Classic Show',
        original_title: null,
        slug: 'classic',
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
        total_watchers: 15000, // Passes popular threshold
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

  it('should return degraded state when no evaluations exist for CATALOG context', async () => {
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

  it('should use popularity as default sort', async () => {
    const rows = [
      {
        id: 'm1',
        tmdb_id: 1,
        title: 'Popular Show',
        original_title: null,
        slug: 'popular',
        overview: null,
        poster_path: '/p.jpg',
        backdrop_path: '/b.jpg',
        release_date: new Date(),
        videos: [],
        ingestion_status: 'done',
        rating: 8,
        vote_count: 1000,
        popularity: 100,
        popularity_score: 0.9,
        total_watchers: 10000,
        last_air_date: null,
        next_air_date: null,
        season_number: null,
        episode_number: null,
      },
    ];

    setup([{ count: 1 }], [rows, [{ total: 1 }]]);

    // Default sort should be popularity
    const res = await query.execute({});
    expect(res).toHaveLength(1);
    expect(res.meta).toEqual({ degraded: false });
  });

  it('should throw DatabaseException on error', async () => {
    db = {
      select: jest.fn().mockReturnValue(createThenable([], new Error('DB error'))),
      execute: jest.fn(),
    };
    query = new PopularShowsQuery(db as any);
    await expect(query.execute({})).rejects.toThrow(DatabaseException);
  });

  describe('year filtering', () => {
    const createShowRow = (id: string, releaseDate: Date) => ({
      id,
      tmdb_id: parseInt(id),
      title: `Show ${id}`,
      original_title: null,
      slug: `show-${id}`,
      overview: null,
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg',
      release_date: releaseDate,
      videos: [],
      ingestion_status: 'done',
      rating: 7,
      vote_count: 500,
      popularity: 50,
      total_watchers: 10000,
      last_air_date: null,
      next_air_date: null,
      season_number: null,
      episode_number: null,
    });

    it('should filter by exact year', async () => {
      const rows = [createShowRow('1', new Date('2023-06-15'))];
      setup([{ count: 1 }], [rows, [{ total: 1 }]]);

      const res = await query.execute({ year: 2023 });

      expect(res).toHaveLength(1);
      expect(db.execute).toHaveBeenCalled();
    });

    it('should filter by yearFrom (inclusive)', async () => {
      const rows = [
        createShowRow('1', new Date('2022-01-01')),
        createShowRow('2', new Date('2023-06-15')),
      ];
      setup([{ count: 1 }], [rows, [{ total: 2 }]]);

      const res = await query.execute({ yearFrom: 2022 });

      expect(res).toHaveLength(2);
    });

    it('should filter by yearTo (inclusive)', async () => {
      const rows = [createShowRow('1', new Date('2020-12-31'))];
      setup([{ count: 1 }], [rows, [{ total: 1 }]]);

      const res = await query.execute({ yearTo: 2020 });

      expect(res).toHaveLength(1);
    });

    it('should filter by year range (yearFrom and yearTo)', async () => {
      const rows = [
        createShowRow('1', new Date('2020-01-01')),
        createShowRow('2', new Date('2021-06-15')),
        createShowRow('3', new Date('2022-12-31')),
      ];
      setup([{ count: 1 }], [rows, [{ total: 3 }]]);

      const res = await query.execute({ yearFrom: 2020, yearTo: 2022 });

      expect(res).toHaveLength(3);
    });
  });

  describe('sort options', () => {
    const createShowRow = (
      id: string,
      scores: Partial<{
        ratingo_score: number;
        popularity_score: number;
        release_date: Date;
        popularity: number;
      }> = {},
    ) => ({
      id,
      tmdb_id: parseInt(id),
      title: `Show ${id}`,
      original_title: null,
      slug: `show-${id}`,
      overview: null,
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg',
      videos: [],
      ingestion_status: 'done',
      rating: 7,
      vote_count: 500,
      total_watchers: 10000,
      last_air_date: null,
      next_air_date: null,
      season_number: null,
      episode_number: null,
      ...scores,
    });

    it('should accept ratingo sort option', async () => {
      const rows = [
        createShowRow('1', { ratingo_score: 90 }),
        createShowRow('2', { ratingo_score: 70 }),
      ];
      setup([{ count: 1 }], [rows, [{ total: 2 }]]);

      const res = await query.execute({ sort: 'ratingo', order: 'desc' });

      expect(res).toHaveLength(2);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept releaseDate sort option', async () => {
      const rows = [
        createShowRow('1', { release_date: new Date('2024-01-01') }),
        createShowRow('2', { release_date: new Date('2023-01-01') }),
      ];
      setup([{ count: 1 }], [rows, [{ total: 2 }]]);

      const res = await query.execute({ sort: 'releaseDate', order: 'desc' });

      expect(res).toHaveLength(2);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept tmdbPopularity sort option', async () => {
      const rows = [
        createShowRow('1', { popularity: 100 }),
        createShowRow('2', { popularity: 50 }),
      ];
      setup([{ count: 1 }], [rows, [{ total: 2 }]]);

      const res = await query.execute({ sort: 'tmdbPopularity', order: 'desc' });

      expect(res).toHaveLength(2);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept trending sort option', async () => {
      const rows = [createShowRow('1', { ratingo_score: 80, popularity_score: 0.8 })];
      setup([{ count: 1 }], [rows, [{ total: 1 }]]);

      const res = await query.execute({ sort: 'trending' });

      expect(res).toHaveLength(1);
      expect(res.meta).toEqual({ degraded: false });
    });

    it('should accept ascending order', async () => {
      const rows = [createShowRow('1', { ratingo_score: 50 })];
      setup([{ count: 1 }], [rows, [{ total: 1 }]]);

      const res = await query.execute({ sort: 'ratingo', order: 'asc' });

      expect(res).toHaveLength(1);
      expect(res.meta).toEqual({ degraded: false });
    });
  });

  describe('pagination', () => {
    const createMinimalRow = (id: string) => ({
      id,
      tmdb_id: parseInt(id),
      title: `Show ${id}`,
      slug: `show-${id}`,
      total_watchers: 10000,
    });

    it('should respect limit parameter', async () => {
      const rows = [createMinimalRow('1'), createMinimalRow('2')] as any[];
      setup([{ count: 1 }], [rows, [{ total: 10 }]]);

      const res = await query.execute({ limit: 2 });

      expect(res).toHaveLength(2);
      expect(res.total).toBe(10);
    });

    it('should respect offset parameter', async () => {
      const rows = [createMinimalRow('3')] as any[];
      setup([{ count: 1 }], [rows, [{ total: 10 }]]);

      const res = await query.execute({ limit: 1, offset: 2 });

      expect(res).toHaveLength(1);
      expect(res.total).toBe(10);
    });
  });

  describe('minRatingo filtering', () => {
    it('should filter by minimum ratingo score', async () => {
      const rows = [
        {
          id: '1',
          tmdb_id: 1,
          title: 'Show',
          slug: 'show',
          ratingo_score: 80,
          total_watchers: 10000,
        },
      ] as any[];
      setup([{ count: 1 }], [rows, [{ total: 1 }]]);

      const res = await query.execute({ minRatingo: 70 });

      expect(res).toHaveLength(1);
    });
  });

  describe('minVotes filtering', () => {
    it('should filter by minimum votes (TMDB)', async () => {
      const rows = [
        {
          id: '1',
          tmdb_id: 1,
          title: 'Show',
          slug: 'show',
          vote_count: 1000,
          total_watchers: 10000,
        },
      ] as any[];
      setup([{ count: 1 }], [rows, [{ total: 1 }]]);

      const res = await query.execute({ minVotes: 500, voteSource: 'tmdb' });

      expect(res).toHaveLength(1);
    });

    it('should filter by minimum votes (Trakt)', async () => {
      const rows = [
        {
          id: '1',
          tmdb_id: 1,
          title: 'Show',
          slug: 'show',
          vote_count_trakt: 500,
          total_watchers: 10000,
        },
      ] as any[];
      setup([{ count: 1 }], [rows, [{ total: 1 }]]);

      const res = await query.execute({ minVotes: 100, voteSource: 'trakt' });

      expect(res).toHaveLength(1);
    });
  });
});
