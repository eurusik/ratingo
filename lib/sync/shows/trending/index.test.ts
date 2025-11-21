import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./caches', () => ({
  createTrendingShowsCache: vi.fn(),
}));
vi.mock('./shows', () => ({
  getTrendingShows: vi.fn(),
  filterValidTraktShows: vi.fn(),
  convertShowsToTaskData: vi.fn(),
}));
vi.mock('./job', () => ({
  createSyncJob: vi.fn(),
}));
vi.mock('./tasks', () => ({
  getPendingTasks: vi.fn(),
}));
vi.mock('./processing', () => ({
  processShowsBatch: vi.fn(),
}));

import { createTrendingShowsCache } from './caches';
import { getTrendingShows, filterValidTraktShows, convertShowsToTaskData } from './shows';
import { createSyncJob } from './job';
import { getPendingTasks } from './tasks';
import { processShowsBatch } from './processing';
import {
  runTrendingShowsSync,
  runTrendingShowsIncremental,
  runTrendingShowsCoordinator,
  runTrendingShowsProcessor,
  getSyncStatus,
  initializeCaches,
} from './index';

describe('shows/trending/index', () => {
  const cache = { details: {}, translations: {}, providers: {}, externalIds: {} };
  const rawShows = [{ a: 1 }, { a: 2 }];
  const validShows = [{ v: 1 }, { v: 2 }];
  const jobId = 99;
  const taskData = [{ id: 1 }];
  const results = [{ success: true }, { success: true }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createTrendingShowsCache).mockReturnValue(cache as any);
    vi.mocked(getTrendingShows).mockResolvedValue(rawShows as any);
    vi.mocked(filterValidTraktShows).mockReturnValue(validShows as any);
    vi.mocked(createSyncJob).mockResolvedValue(jobId as any);
    vi.mocked(convertShowsToTaskData).mockReturnValue(taskData as any);
    vi.mocked(processShowsBatch).mockResolvedValue(results as any);
  });

  it('runTrendingShowsSync orchestrates flow and returns summary', async () => {
    const res = await runTrendingShowsSync({ limit: 33, maxWatchers: 777, concurrency: 4 });
    expect(createTrendingShowsCache).toHaveBeenCalledTimes(1);
    expect(getTrendingShows).toHaveBeenCalledWith(33);
    expect(filterValidTraktShows).toHaveBeenCalledWith(rawShows);
    expect(createSyncJob).toHaveBeenCalledTimes(1);
    expect(convertShowsToTaskData).toHaveBeenCalledWith(validShows, jobId);
    expect(processShowsBatch).toHaveBeenCalledWith(taskData, expect.any(Object), 4);
    const [, ctx] = vi.mocked(processShowsBatch).mock.calls[0];
    expect(ctx.maxWatchers).toBe(777);
    expect(ctx.tmdbDetailsCache).toBe(cache.details);
    expect(ctx.tmdbTranslationCache).toBe(cache.translations);
    expect(ctx.tmdbProvidersCache).toBe(cache.providers);
    expect(ctx.tmdbExternalIdsCache).toBe(cache.externalIds);
    expect(res).toEqual({ success: true, processed: results.length, timestamp: expect.any(Date) });
  });

  it('runTrendingShowsIncremental uses defaults and returns summary', async () => {
    const res = await runTrendingShowsIncremental(10, 5);
    expect(getTrendingShows).toHaveBeenCalledWith(10);
    const [, ctx] = vi.mocked(processShowsBatch).mock.calls[0];
    expect(ctx.maxWatchers).toBe(10000);
    expect(res).toEqual({ success: true, processed: results.length, timestamp: expect.any(Date) });
  });

  it('runTrendingShowsCoordinator uses fixed limit', async () => {
    await runTrendingShowsCoordinator();
    expect(getTrendingShows).toHaveBeenCalledWith(20);
  });

  it('runTrendingShowsProcessor uses provided limit', async () => {
    await runTrendingShowsProcessor(7);
    expect(getTrendingShows).toHaveBeenCalledWith(7);
  });

  it('getSyncStatus returns pending info', async () => {
    vi.mocked(getPendingTasks).mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    const res = await getSyncStatus();
    expect(getPendingTasks).toHaveBeenCalledWith(10);
    expect(res).toEqual({ hasPendingTasks: true, pendingCount: 2, timestamp: expect.any(Date) });
  });

  it('initializeCaches delegates to createTrendingShowsCache', () => {
    const res = initializeCaches();
    expect(createTrendingShowsCache).toHaveBeenCalledTimes(1);
    expect(res).toBe(cache);
  });
});
