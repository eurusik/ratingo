import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareTraktData, calculateMaxWatchers, processMovieTask } from './processor';
import type { SyncTask, MovieProcessingOptions, TraktMovieData } from './types';

vi.mock('@/lib/sync/movies/processing', () => ({
  processMovie: vi.fn(),
}));
import { processMovie } from '@/lib/sync/movies/processing';

describe('movies/trending/processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prepareTraktData extracts watchers and movie payload', () => {
    const task: SyncTask = {
      id: 1,
      jobId: 10,
      tmdbId: 123,
      payload: { watchers: 150, traktMovie: { ids: { tmdb: 123 }, title: 'Title' } },
    };
    const res = prepareTraktData(task);
    expect(res.watchers).toBe(150);
    expect(res.movie.ids.tmdb).toBe(123);
    expect(res.movie.title).toBe('Title');
  });

  it('prepareTraktData falls back to tmdbId when missing traktMovie', () => {
    const task: SyncTask = { id: 1, jobId: 10, tmdbId: 321, payload: {} };
    const res = prepareTraktData(task);
    expect(res.movie.ids.tmdb).toBe(321);
    expect(res.movie.title).toBeNull();
    expect(res.watchers).toBeUndefined();
  });

  it('calculateMaxWatchers enforces minimum 10000', () => {
    const low: TraktMovieData = { watchers: 5000, movie: { ids: { tmdb: 1 } } };
    const high: TraktMovieData = { watchers: 15000, movie: { ids: { tmdb: 1 } } };
    const none: TraktMovieData = { movie: { ids: { tmdb: 1 } } } as any;
    expect(calculateMaxWatchers(low)).toBe(10000);
    expect(calculateMaxWatchers(high)).toBe(15000);
    expect(calculateMaxWatchers(none)).toBe(10000);
  });

  it('processMovieTask calls processMovie with computed maxWatchers', async () => {
    const task: SyncTask = {
      id: 1,
      jobId: 10,
      tmdbId: 555,
      payload: { watchers: 120 },
    };
    const options: MovieProcessingOptions = {
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      maxWatchers: 0,
      tmdbDetailsCache: {},
      tmdbTranslationCache: {},
      tmdbProvidersCache: {},
      tmdbExternalIdsCache: {},
    };
    const mockResult = { success: true } as any;
    vi.mocked(processMovie).mockResolvedValueOnce(mockResult);
    const res = await processMovieTask(task, options);
    expect(processMovie).toHaveBeenCalledTimes(1);
    const [argItem, argCtx] = vi.mocked(processMovie).mock.calls[0];
    expect(argItem.movie.ids.tmdb).toBe(555);
    expect(argCtx.maxWatchers).toBe(10000);
    expect(res).toBe(mockResult);
  });
});
