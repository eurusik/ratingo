import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  upsertShow,
  upsertShowRatings,
  upsertShowRatingBuckets,
  upsertShowVideos,
  upsertShowWatchProviders,
  upsertShowContentRatings,
  upsertShowCast,
  upsertShowTranslations,
  upsertShowGenres,
  upsertShowWatchersSnapshot,
} from './upserts';

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

vi.mock('@/db/schema', () => ({
  shows: { id: { name: 'id' }, tmdbId: { name: 'tmdb_id' } },
  showRatings: { id: { name: 'id' }, showId: { name: 'show_id' } },
  showRatingBuckets: {
    id: { name: 'id' },
    showId: { name: 'show_id' },
    bucket: { name: 'bucket' },
  },
  showVideos: {
    id: { name: 'id' },
    showId: { name: 'show_id' },
    site: { name: 'site' },
    key: { name: 'key' },
  },
  showWatchProviders: {
    id: { name: 'id' },
    showId: { name: 'show_id' },
    region: { name: 'region' },
    providerId: { name: 'provider_id' },
    category: { name: 'category' },
  },
  showContentRatings: {
    id: { name: 'id' },
    showId: { name: 'show_id' },
    region: { name: 'region' },
  },
  showCast: {
    id: { name: 'id' },
    showId: { name: 'show_id' },
    personId: { name: 'person_id' },
    character: { name: 'character' },
  },
  showTranslations: { id: { name: 'id' }, showId: { name: 'show_id' }, locale: { name: 'locale' } },
  genres: { id: { name: 'id' }, tmdbId: { name: 'tmdb_id' } },
  showGenres: { genreId: { name: 'genre_id' }, showId: { name: 'show_id' } },
  showWatchersSnapshots: {
    watchers: { name: 'watchers' },
    tmdbId: { name: 'tmdb_id' },
    createdAt: { name: 'created_at' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    eq: vi.fn((f: any, v: any) => ({ field: f.name, value: v })),
    inArray: vi.fn((f: any, arr: any[]) => ({ field: f.name, arr })),
    desc: vi.fn((f: any) => ({ desc: f.name })),
  };
});

describe('shows/upserts', () => {
  let tx: any;
  beforeEach(() => {
    tx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    };
  });

  it('upsertShow inserts when not existing and updates when existing', async () => {
    vi.mocked(tx.limit).mockResolvedValueOnce([]);
    vi.mocked(tx.returning).mockResolvedValueOnce([{ id: 99 }]);
    const insertRes = await upsertShow(tx, 123, { title: 'New' } as any);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(insertRes).toEqual({ showId: 99, isUpdate: false });
    vi.mocked(tx.select).mockClear();
    vi.mocked(tx.limit).mockResolvedValueOnce([{ id: 88 }]);
    const updateRes = await upsertShow(tx, 123, { title: 'Upd' } as any);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(updateRes).toEqual({ showId: 88, isUpdate: true });
  });

  it('upsertShowRatings inserts or updates based on existence', async () => {
    vi.mocked(tx.limit).mockResolvedValueOnce([]);
    await upsertShowRatings(tx, 10, 7.5, 100);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    vi.mocked(tx.limit).mockResolvedValueOnce([{ id: 1 }]);
    await upsertShowRatings(tx, 10, 8.0, 200);
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it('upsertShowRatingBuckets handles updates and inserts', async () => {
    vi.mocked(tx.where).mockResolvedValueOnce([
      { id: 1, bucket: 8 },
      { id: 2, bucket: 9 },
    ]);
    const changed = await upsertShowRatingBuckets(tx, 10, { '8': 50, '9': 60, '10': 70 } as any);
    expect(changed).toBe(3);
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('upsertShowVideos updates existing and inserts new', async () => {
    vi.mocked(tx.where).mockResolvedValueOnce([{ id: 1, site: 'YouTube', key: 'k1' }]);
    const videos = [
      { site: 'YouTube', key: 'k1', name: 'A' },
      { site: 'YouTube', key: 'k2', name: 'B' },
    ] as any;
    await upsertShowVideos(tx, 10, videos);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('upsertShowWatchProviders updates existing and inserts new', async () => {
    vi.mocked(tx.where).mockResolvedValueOnce([
      { id: 2, region: 'UA', providerId: 1, category: 'flatrate' },
    ]);
    const providers = [
      { region: 'UA', id: 1, category: 'flatrate', name: 'A' },
      { region: 'UA', id: 2, category: 'ads', name: 'B' },
    ] as any;
    await upsertShowWatchProviders(tx, 10, providers);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('upsertShowContentRatings updates existing regions and inserts missing', async () => {
    vi.mocked(tx.where).mockResolvedValueOnce([{ id: 1, region: 'UA' }]);
    await upsertShowContentRatings(tx, 10, { UA: '16+', US: 'TV-14' });
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('upsertShowCast updates existing and inserts new', async () => {
    vi.mocked(tx.where).mockResolvedValueOnce([{ id: 1, personId: 100, character: 'C' }]);
    const cast = [
      { id: 100, name: 'P', character: 'C', order: 0, profile_path: '/p.jpg' },
      { id: 101, name: 'Q', character: 'D', order: 1, profile_path: '/q.jpg' },
    ] as any;
    await upsertShowCast(tx, 10, cast);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('upsertShowTranslations updates existing locale and inserts new', async () => {
    vi.mocked(tx.where).mockResolvedValueOnce([{ id: 1, locale: 'uk-UA' }]);
    await upsertShowTranslations(tx, 10, [
      { locale: 'uk-UA', title: 'A', overview: 'O', tagline: null },
      { locale: 'en-US', title: 'B', overview: 'P', tagline: 'T' },
    ]);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('upsertShowGenres inserts links for non-existing genres', async () => {
    vi.mocked(tx.where).mockResolvedValueOnce([
      { id: 1, tmdbId: 10 },
      { id: 2, tmdbId: 11 },
    ]);
    vi.mocked(tx.where).mockResolvedValueOnce([
      { id: 1, tmdbId: 10 },
      { id: 2, tmdbId: 11 },
      { id: 3, tmdbId: 12 },
    ]);
    vi.mocked(tx.where).mockResolvedValueOnce([{ genreId: 1 }]);
    await upsertShowGenres(tx, 10, [
      { id: 10, name: 'Action' },
      { id: 11, name: 'Drama' },
      { id: 12, name: 'Fantasy' },
    ]);
    expect(tx.insert).toHaveBeenCalledTimes(2);
    const valuesArg = vi.mocked(tx.values).mock.calls.slice(-1)[0][0] as any[];
    expect(valuesArg.length).toBeGreaterThan(0);
  });

  it('upsertShowWatchersSnapshot inserts when changed and returns unchanged when same', async () => {
    vi.mocked(tx.limit).mockResolvedValueOnce([{ watchers: 100 }]);
    const statusSame = await upsertShowWatchersSnapshot(tx, 123, 10, 100);
    expect(statusSame).toBe('unchanged');
    vi.mocked(tx.limit).mockResolvedValueOnce([{ watchers: 90 }]);
    const statusIns = await upsertShowWatchersSnapshot(tx, 123, 10, 100);
    expect(statusIns).toBe('inserted');
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });
});
