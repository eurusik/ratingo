import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateTrendingScore, computeDeltas, fetchTraktRatings } from './metrics';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ ratingTraktPrev: 1000 }]),
    orderBy: vi.fn().mockReturnThis(),
  },
}));
vi.mock('@/db/schema', () => ({
  shows: { ratingTrakt: { name: 'rating_trakt' }, tmdbId: { name: 'tmdb_id' } },
  showWatchersSnapshots: {
    watchers: { name: 'watchers' },
    tmdbId: { name: 'tmdb_id' },
    createdAt: { name: 'created_at' },
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((f: any, v: any) => `eq(${f.name}, ${v})`),
}));

vi.mock('@/lib/api/trakt', () => ({
  traktClient: { getShowRatings: vi.fn() },
}));

vi.mock('@/lib/sync/utils', () => ({
  withRetry: vi.fn(async (fn: any) => await fn()),
}));

import { db } from '@/db';
import { traktClient } from '@/lib/api/trakt';

describe('shows/processing/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateTrendingScore коректно поєднує рейтинг і глядачів', () => {
    expect(calculateTrendingScore(8.5, 2500, 10000)).toBe(
      Math.round(8.5 * 5 + (2500 / 10000) * 50)
    );
    expect(calculateTrendingScore(11, 2500, 10000)).toBe(Math.round(10 * 5 + 12.5));
    expect(calculateTrendingScore(-5, 2500, 10000)).toBe(Math.round(0 * 5 + 12.5));
  });

  it('computeDeltas використовує monthly дельту коли доступна', async () => {
    (db as any).limit.mockResolvedValueOnce([{ ratingTraktPrev: 900 }]);
    const ctx = {
      maxWatchers: 10000,
      monthly: { m0: { 1: 1200 }, m1: { 1: 1000 }, m2: {}, m3: {}, m4: {}, m5: {} },
    } as any;
    const res = await computeDeltas(1, 1500, 8.5, ctx);
    expect(res.trendingScore).toBe(calculateTrendingScore(8.5, 1500, 10000));
    expect(res.watchersDelta).toBe(200);
  });

  it('computeDeltas використовує попередній рейтинг якщо monthly недоступна', async () => {
    (db as any).limit.mockResolvedValueOnce([{ ratingTraktPrev: 1400 }]);
    const ctx = {
      maxWatchers: 10000,
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
    } as any;
    const res = await computeDeltas(2, 1500, 8.5, ctx);
    expect(res.watchersDelta).toBe(100);
  });

  it('computeDeltas рахує delta3m із snapshots коли сума останніх 3 місяців дорівнює попереднім', async () => {
    (db as any).limit
      .mockResolvedValueOnce([{ ratingTraktPrev: 1400 }]) // попередній рейтинг
      .mockResolvedValueOnce([
        { watchers: 100 },
        { watchers: 110 },
        { watchers: 120 }, // recent
        { watchers: 80 },
        { watchers: 85 },
        { watchers: 90 }, // prev3
      ]);
    const ctx = {
      maxWatchers: 10000,
      monthly: {
        m0: { 3: 100 },
        m1: { 3: 90 },
        m2: { 3: 85 },
        m3: { 3: 95 },
        m4: { 3: 100 },
        m5: { 3: 80 },
      },
    } as any;
    // Налаштувати monthly так, щоб sumRecent3 - sumPrev3 === 0
    ctx.monthly.m0[3] = 100;
    ctx.monthly.m1[3] = 90;
    ctx.monthly.m2[3] = 85; // 275
    ctx.monthly.m3[3] = 95;
    ctx.monthly.m4[3] = 100;
    ctx.monthly.m5[3] = 80; // 275
    const res = await computeDeltas(3, 1500, 8.5, ctx);
    expect(res.delta3mVal).toBe(100 + 110 + 120 - (80 + 85 + 90));
  });

  it('fetchTraktRatings повертає числа і distribution', async () => {
    vi.mocked(traktClient.getShowRatings).mockResolvedValue({
      rating: 7.2,
      votes: 1234,
      distribution: { a: 1 },
    } as any);
    const ctx = { onRetryLabel: () => vi.fn() } as any;
    const res = await fetchTraktRatings('slug', ctx);
    expect(res.ratingTraktAvg).toBe(7.2);
    expect(res.ratingTraktVotes).toBe(1234);
    expect(res.ratingDistribution).toEqual({ a: 1 });
  });
});
