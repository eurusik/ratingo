import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertMovie } from './upserts/movie';
import { upsertMovieRatings, upsertRatingBuckets } from './upserts/ratings';
import { upsertMovieVideos, upsertContentRatings } from './upserts/media';
import { upsertMovieCast } from './upserts/cast';

vi.mock('@/db/schema', () => ({
  movies: { id: { name: 'movies.id' }, tmdbId: { name: 'tmdb_id' } },
  movieRatings: { id: { name: 'ratings.id' }, movieId: { name: 'movie_id' } },
  movieRatingBuckets: {
    id: { name: 'bucket.id' },
    movieId: { name: 'movie_id' },
    bucket: { name: 'bucket' },
  },
  movieVideos: {
    id: { name: 'video.id' },
    movieId: { name: 'movie_id' },
    site: { name: 'site' },
    key: { name: 'key' },
  },
  movieContentRatings: {
    id: { name: 'content.id' },
    movieId: { name: 'movie_id' },
    region: { name: 'region' },
  },
  movieCast: {
    id: { name: 'cast.id' },
    movieId: { name: 'movie_id' },
    personId: { name: 'person_id' },
    character: { name: 'character' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    eq: vi.fn((f, v) => `eq(${f.name}, ${v})`),
    inArray: vi.fn((f, arr) => `inArray(${f.name}, ${arr.join(',')})`),
  };
});

const mockTx = {
  _table: null as any,
  select: vi.fn(function () {
    return mockTx;
  }),
  from: vi.fn(function (t) {
    mockTx._table = t;
    return mockTx;
  }),
  where: vi.fn(() => {
    const key = mockTx._tableKey();
    if (key === 'movies' || key === 'movieRatings') {
      return mockTx;
    }
    return Promise.resolve(mockWhereResult[key] || []);
  }),
  limit: vi.fn(() => Promise.resolve(mockLimitResult[mockTx._tableKey()] || [])),
  update: vi.fn(() => mockTx),
  set: vi.fn(() => mockTx),
  insert: vi.fn((t) => {
    const key = mockTx._tableKey(t);
    if (key === 'movies') {
      return {
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 101 }])),
        })),
      };
    }
    return {
      values: vi.fn(() => Promise.resolve(undefined)),
    };
  }),
  _tableKey: (t?: any) => {
    const obj = t || mockTx._table;
    if (!obj) return 'unknown';
    if (obj.tmdbId?.name === 'tmdb_id') return 'movies';
    if (obj.bucket?.name === 'bucket') return 'movieRatingBuckets';
    if (obj.site?.name === 'site') return 'movieVideos';
    if (obj.region?.name === 'region') return 'movieContentRatings';
    if (obj.personId?.name === 'person_id') return 'movieCast';
    if (obj.movieId?.name === 'movie_id' && obj.id?.name === 'ratings.id') return 'movieRatings';
    return 'unknown';
  },
};

let mockWhereResult: Record<string, any[]>;
let mockLimitResult: Record<string, any[]>;

vi.mock('@/db', () => ({ db: { transaction: vi.fn(async (cb) => cb(mockTx)) } }));

describe('movies/upserts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhereResult = {};
    mockLimitResult = {};
  });

  it('upsertMovie updates when existing, inserts when not', async () => {
    const payload = { any: 'record' } as any;
    // Update path
    mockLimitResult['movies'] = [{ id: 5 }];
    const resUpdate = await upsertMovie(mockTx as any, 123, payload);
    expect(resUpdate).toEqual({ movieId: 5, isUpdate: true });
    expect(mockTx.update).toHaveBeenCalled();

    // Insert path
    mockLimitResult['movies'] = [];
    const resInsert = await upsertMovie(mockTx as any, 124, payload);
    expect(resInsert).toEqual({ movieId: 101, isUpdate: false });
  });

  it('upsertMovieRatings updates existing or inserts new', async () => {
    // Update path
    mockLimitResult['movieRatings'] = [{ id: 7 }];
    await upsertMovieRatings(mockTx as any, 50, 8.1, 200);
    expect(mockTx.update).toHaveBeenCalled();
    // Insert path
    mockLimitResult['movieRatings'] = [];
    await upsertMovieRatings(mockTx as any, 50, null, null);
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('upsertRatingBuckets updates existing buckets and inserts new ones', async () => {
    mockWhereResult['movieRatingBuckets'] = [{ id: 1, bucket: 1 }];
    const changed = await upsertRatingBuckets(mockTx as any, 50, { '1': 3, '2': 5, bad: 9 } as any);
    expect(changed).toBe(2);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('upsertMovieVideos updates existing and inserts new', async () => {
    mockWhereResult['movieVideos'] = [{ id: 10, site: 'YouTube', key: 'abc' }];
    await upsertMovieVideos(mockTx as any, 70, [
      { site: 'YouTube', key: 'abc', name: 'A' }, // update
      { site: 'YouTube', key: 'def', name: 'B' }, // insert
    ] as any);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('upsertContentRatings updates UA and inserts US', async () => {
    mockWhereResult['movieContentRatings'] = [{ id: 20, region: 'UA' }];
    await upsertContentRatings(mockTx as any, 70, { UA: '12+', US: 'PG-13' });
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('upsertMovieCast updates existing and inserts new', async () => {
    mockWhereResult['movieCast'] = [{ id: 30, personId: 1, character: 'X' }];
    await upsertMovieCast(mockTx as any, 70, [
      { id: 1, name: 'A', character: 'X' }, // update
      { id: 2, name: 'B', character: null }, // insert
    ] as any);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();
  });
});
