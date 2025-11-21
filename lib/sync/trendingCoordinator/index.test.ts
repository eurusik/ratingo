import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTrendingCoordinator } from './index';

vi.mock('./job', () => ({
  createSyncJob: vi.fn(async () => 42),
  updateJobStats: vi.fn(async () => {}),
}));

vi.mock('./shows', () => ({
  getTrendingShows: vi.fn(
    async () =>
      [
        { watchers: 120, show: { ids: { tmdb: 100 }, title: 'A' } },
        { watchers: 80, show: { ids: { tmdb: 101 }, title: 'B' } },
      ] as any
  ),
  convertShowsToTaskData: vi.fn((shows: any[], jobId: number) =>
    shows.map((s) => ({
      jobId,
      tmdbId: s.show.ids.tmdb,
      payload: { watchers: s.watchers, traktShow: s.show },
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  ),
}));

vi.mock('./tasks', () => ({
  createTasksBatch: vi.fn(async (data: any[]) => data.length),
}));

import { createSyncJob, updateJobStats } from './job';
import { getTrendingShows, convertShowsToTaskData } from './shows';
import { createTasksBatch } from './tasks';

describe('trendingCoordinator/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runTrendingCoordinator orchestrates flow and returns summary', async () => {
    const res = await runTrendingCoordinator();
    expect(createSyncJob).toHaveBeenCalledTimes(1);
    expect(getTrendingShows).toHaveBeenCalledWith(100);
    expect(convertShowsToTaskData).toHaveBeenCalledTimes(1);
    expect(createTasksBatch).toHaveBeenCalledTimes(1);
    expect(updateJobStats).toHaveBeenCalledWith(42, 2, 2);
    expect(res).toEqual({
      success: true,
      jobId: 42,
      tasksQueued: 2,
      totals: { trendingFetched: 2 },
    });
  });
});
