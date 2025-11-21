import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrendingShows, extractValidTmdbId, convertShowsToTaskData } from './shows';

vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    getTrendingShows: vi.fn(),
  },
}));

vi.mock('@/lib/sync/utils', () => ({
  withRetry: vi.fn(async (fn: any) => await fn()),
}));

import { traktClient } from '@/lib/api/trakt';

describe('trendingCoordinator/shows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getTrendingShows returns array or empty on non-array', async () => {
    vi.mocked(traktClient.getTrendingShows).mockResolvedValue([
      { show: { ids: { tmdb: 123 } }, watchers: 10 },
    ] as any);
    const a = await getTrendingShows(50);
    expect(a).toHaveLength(1);
    vi.mocked(traktClient.getTrendingShows).mockResolvedValue({} as any);
    const b = await getTrendingShows();
    expect(b).toEqual([]);
  });

  it('extractValidTmdbId validates positive finite numbers', () => {
    expect(extractValidTmdbId({ show: { ids: { tmdb: 10 } } } as any)).toBe(10);
    expect(extractValidTmdbId({ show: { ids: { tmdb: 0 } } } as any)).toBeNull();
    expect(extractValidTmdbId({ show: { ids: { tmdb: 'x' } } } as any)).toBeNull();
  });

  it('convertShowsToTaskData maps shows to task payloads and filters invalid', () => {
    const input = [
      { watchers: 100, show: { ids: { tmdb: 10 }, title: 'A' } },
      { watchers: 50, show: { ids: { tmdb: null }, title: 'B' } },
    ] as any;
    const out = convertShowsToTaskData(input, 77);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ jobId: 77, tmdbId: 10, status: 'pending', attempts: 0 });
  });
});
