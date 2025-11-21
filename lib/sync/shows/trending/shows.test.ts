import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTrendingShows,
  extractValidTmdbId,
  filterValidTraktShows,
  convertShowsToTaskData,
} from './shows';

vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    getTrendingShows: vi.fn(),
  },
}));
vi.mock('@/lib/sync/utils', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

import { traktClient } from '@/lib/api/trakt';

describe('shows/trending/shows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getTrendingShows returns array and calls traktClient with limit', async () => {
    const items = [{ show: { ids: { tmdb: 1 } }, watchers: 10 }];
    vi.mocked(traktClient.getTrendingShows).mockResolvedValue(items as any);
    const res = await getTrendingShows(25);
    expect(res).toEqual(items);
    expect(traktClient.getTrendingShows).toHaveBeenCalledWith(25);
  });

  it('extractValidTmdbId validates tmdbId', () => {
    expect(extractValidTmdbId({ show: { ids: { tmdb: 10 } } } as any)).toBe(10);
    expect(extractValidTmdbId({ show: { ids: { tmdb: 0 } } } as any)).toBeNull();
    expect(extractValidTmdbId({ show: { ids: { tmdb: 'x' } } } as any)).toBeNull();
  });

  it('filterValidTraktShows filters invalid items', () => {
    const arr = [
      { show: { ids: { tmdb: 1 } }, watchers: 10 },
      { show: { ids: { tmdb: 0 } } },
      { show: { ids: { tmdb: 2 } }, watchers: 5 },
    ] as any[];
    const res = filterValidTraktShows(arr as any);
    expect(res).toEqual([
      { show: { ids: { tmdb: 1 } }, watchers: 10 },
      { show: { ids: { tmdb: 2 } }, watchers: 5 },
    ]);
  });

  it('convertShowsToTaskData builds task payloads and filters invalid', () => {
    const jobId = 77;
    const arr = [
      { show: { ids: { tmdb: 1 }, title: 'A' }, watchers: 10 },
      { show: { ids: { tmdb: 0 } }, watchers: 5 },
    ] as any[];
    const res = convertShowsToTaskData(arr as any, jobId) as any[];
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ tmdbId: 1, jobId, status: 'pending' });
    expect(res[0].payload.watchers).toBe(10);
    expect(res[0].payload.traktShow.title).toBe('A');
  });
});
