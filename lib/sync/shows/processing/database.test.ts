import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  upsertShow,
  upsertShowRatings,
  upsertShowWatchProviders,
  upsertShowRatingBuckets,
  upsertShowWatchersSnapshot,
} from './database';

vi.mock('@/db/schema', () => ({
  shows: { id: { name: 'id' }, tmdbId: { name: 'tmdb_id' } },
  showRatings: {
    showId: { name: 'show_id' },
    source: { name: 'source' },
    avg: { name: 'avg' },
    votes: { name: 'votes' },
  },
  showWatchProviders: {
    showId: { name: 'show_id' },
    region: { name: 'region' },
    providerId: { name: 'provider_id' },
    providerName: { name: 'provider_name' },
    logoPath: { name: 'logo_path' },
    linkUrl: { name: 'link_url' },
    category: { name: 'category' },
    rank: { name: 'rank' },
  },
  showRatingBuckets: {
    showId: { name: 'show_id' },
    source: { name: 'source' },
    bucket: { name: 'bucket' },
    count: { name: 'count' },
  },
  showWatchersSnapshots: {
    id: { name: 'id' },
    showId: { name: 'show_id' },
    createdAt: { name: 'created_at' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    eq: vi.fn((f, v) => ({ op: 'eq', field: f.name, value: v })),
    and: vi.fn((...args) => ({ op: 'and', args })),
    gte: vi.fn((f, v) => ({ op: 'gte', field: f.name, value: v })),
  };
});

describe('shows/processing/database', () => {
  let tx: any;
  let selectBuilder: any;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-01T00:00:00.000Z'));
    selectBuilder = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    tx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnValue(null),
      returning: vi.fn().mockReturnValue([{ id: 42 }]),
      select: vi.fn().mockReturnValue(selectBuilder),
    };
    vi.mocked(tx.onConflictDoUpdate).mockReturnValue(tx);
  });

  it('upsertShow повертає id та isUpdate=true', async () => {
    const showData: any = {
      title: 't',
      titleUk: 'u',
      overview: 'o',
      overviewUk: 'ou',
      poster: 'p',
      posterUk: 'pu',
      backdrop: 'b',
      ratingTmdb: 7,
      ratingTmdbCount: 100,
      popularityTmdb: 50,
      ratingImdb: 6.5,
      imdbVotes: 1000,
      ratingMetacritic: 70,
      firstAirDate: '2024-01-01',
      status: 'Running',
      tagline: 'tag',
      numberOfSeasons: 3,
      numberOfEpisodes: 24,
      latestSeasonNumber: 3,
      latestSeasonEpisodes: 8,
      lastEpisodeSeason: 3,
      lastEpisodeNumber: 8,
      lastEpisodeAirDate: '2025-01-31',
      nextEpisodeSeason: null,
      nextEpisodeNumber: null,
      nextEpisodeAirDate: null,
      contentRating: 'TV-14',
      trendingScore: 123,
      delta3m: 10,
      watchersDelta: 2,
      ratingTrakt: 200,
    };
    const res = await upsertShow(tx, 123, showData);
    expect(res).toEqual({ showId: 42, isUpdate: true });
    expect(tx.insert).toHaveBeenCalled();
    expect(tx.onConflictDoUpdate).toHaveBeenCalled();
    expect(tx.returning).toHaveBeenCalledWith({ id: expect.any(Object) });
  });

  it('upsertShowRatings пропускає коли обидва значення null та оновлює коли задані', async () => {
    await upsertShowRatings(tx, 10, null, null);
    expect(tx.insert).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'showRatings' }));
    await upsertShowRatings(tx, 10, 8.5, 1500);
    expect(tx.insert).toHaveBeenCalled();
    expect(tx.onConflictDoUpdate).toHaveBeenCalled();
  });

  it('upsertShowWatchProviders додає та оновлює провайдерів', async () => {
    const providers = [
      {
        region: 'UA',
        providerId: 1,
        providerName: 'Netflix',
        logoPath: '/n.png',
        linkUrl: 'http://n',
        category: 'flatrate',
        rank: 1,
      },
      {
        region: 'US',
        providerId: 2,
        providerName: 'HBO',
        logoPath: '/h.png',
        linkUrl: 'http://h',
        category: 'flatrate',
        rank: 2,
      },
    ];
    await upsertShowWatchProviders(tx, 10, providers);
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(tx.onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it('upsertShowRatingBuckets повертає кількість змінених записів', async () => {
    vi.mocked(tx.onConflictDoUpdate).mockReturnValue({ rowsAffected: 1 } as any);
    const changed = await upsertShowRatingBuckets(tx, 10, { '1': 10, '2': 20 });
    expect(changed).toBe(2);
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(tx.onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it('upsertShowWatchersSnapshot вставляє якщо не існує та пропускає якщо існує', async () => {
    let res = await upsertShowWatchersSnapshot(tx, 123, 10, 200);
    expect(res).toBe('inserted');
    expect(tx.insert).toHaveBeenCalledTimes(1);
    selectBuilder.limit.mockResolvedValueOnce([{ id: 1 }]);
    tx.insert.mockClear();
    res = await upsertShowWatchersSnapshot(tx, 123, 10, 200);
    expect(res).toBe('unchanged');
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
