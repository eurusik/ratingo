import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./caches', () => ({
  createTrendingMoviesCache: vi.fn(),
}));
vi.mock('./movies', () => ({
  getTrendingMovies: vi.fn(),
  convertMoviesToTaskData: vi.fn(),
}));
vi.mock('./job', () => ({
  createSyncJob: vi.fn(),
}));
vi.mock('./tasks', () => ({
  getPendingTasks: vi.fn(),
}));
vi.mock('./processing', () => ({
  processMoviesBatch: vi.fn(),
}));
vi.mock('./trakt', () => ({
  filterValidTraktMovies: vi.fn(),
}));

import { createTrendingMoviesCache } from './caches';
import { getTrendingMovies, convertMoviesToTaskData } from './movies';
import { createSyncJob } from './job';
import { getPendingTasks } from './tasks';
import { processMoviesBatch } from './processing';
import { filterValidTraktMovies } from './trakt';
import {
  runTrendingMoviesSync,
  runTrendingMoviesIncremental,
  runTrendingMoviesCoordinator,
  runTrendingMoviesProcessor,
  getSyncStatus,
  initializeCaches,
} from './index';

describe('movies/trending/index', () => {
  const cache = { details: {}, translations: {}, providers: {}, externalIds: {} };
  const rawMovies = [{ a: 1 }, { a: 2 }];
  const validMovies = [{ v: 1 }, { v: 2 }];
  const jobId = 42;
  const results = [{ success: true }, { success: true }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createTrendingMoviesCache).mockReturnValue(cache);
    vi.mocked(getTrendingMovies).mockResolvedValue(rawMovies as any);
    vi.mocked(filterValidTraktMovies).mockReturnValue(validMovies as any);
    vi.mocked(createSyncJob).mockResolvedValue(jobId);
    vi.mocked(convertMoviesToTaskData).mockReturnValue([{ id: 1 }] as any);
    vi.mocked(processMoviesBatch).mockResolvedValue(results as any);
  });

  it('runTrendingMoviesSync orchestrates flow and returns summary', async () => {
    const res = await runTrendingMoviesSync({ limit: 50, maxWatchers: 12345 });
    expect(createTrendingMoviesCache).toHaveBeenCalledTimes(1);
    expect(getTrendingMovies).toHaveBeenCalledWith(50);
    expect(filterValidTraktMovies).toHaveBeenCalledWith(rawMovies);
    expect(createSyncJob).toHaveBeenCalledTimes(1);
    expect(convertMoviesToTaskData).toHaveBeenCalledWith(validMovies, jobId);
    expect(processMoviesBatch).toHaveBeenCalledTimes(1);
    const [, ctx] = vi.mocked(processMoviesBatch).mock.calls[0];
    expect(ctx.maxWatchers).toBe(12345);
    expect(ctx.tmdbDetailsCache).toBe(cache.details);
    expect(ctx.tmdbTranslationCache).toBe(cache.translations);
    expect(ctx.tmdbProvidersCache).toBe(cache.providers);
    expect(ctx.tmdbExternalIdsCache).toBe(cache.externalIds);
    expect(res).toEqual({ success: true, processed: results.length, timestamp: expect.any(Date) });
  });

  it('runTrendingMoviesIncremental uses defaults and returns summary', async () => {
    const res = await runTrendingMoviesIncremental(10, 5);
    expect(getTrendingMovies).toHaveBeenCalledWith(10);
    const [, ctx] = vi.mocked(processMoviesBatch).mock.calls[0];
    expect(ctx.maxWatchers).toBe(10000);
    expect(res).toEqual({ success: true, processed: results.length, timestamp: expect.any(Date) });
  });

  it('runTrendingMoviesCoordinator uses fixed limit', async () => {
    await runTrendingMoviesCoordinator();
    expect(getTrendingMovies).toHaveBeenCalledWith(20);
  });

  it('runTrendingMoviesProcessor uses provided limit', async () => {
    await runTrendingMoviesProcessor(7);
    expect(getTrendingMovies).toHaveBeenCalledWith(7);
  });

  it('getSyncStatus returns pending info', async () => {
    vi.mocked(getPendingTasks).mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    const res = await getSyncStatus();
    expect(getPendingTasks).toHaveBeenCalledWith(10);
    expect(res).toEqual({ hasPendingTasks: true, pendingCount: 2, timestamp: expect.any(Date) });
  });

  it('initializeCaches delegates to createTrendingMoviesCache', () => {
    const res = initializeCaches();
    expect(createTrendingMoviesCache).toHaveBeenCalledTimes(1);
    expect(res).toBe(cache);
  });
});
