import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMoviesBatch, aggregateResults } from './processing';

vi.mock('@/lib/sync/movies/processing', () => ({
  processMovie: vi.fn(),
}));
import { processMovie } from '@/lib/sync/movies/processing';

describe('movies/trending/processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processMoviesBatch processes all movies with given concurrency', async () => {
    const movies = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    const options = { monthly: {}, maxWatchers: 10000 } as any;
    vi.mocked(processMovie).mockImplementation(
      async (m) => ({ success: true, added: 1, skipped: false }) as any
    );
    const res = await processMoviesBatch(movies as any, options, 2);
    expect(processMovie).toHaveBeenCalledTimes(movies.length);
    for (let i = 0; i < movies.length; i++) {
      expect(processMovie).toHaveBeenNthCalledWith(i + 1, movies[i], options);
    }
    expect(res).toHaveLength(movies.length);
  });

  it('aggregateResults computes totals and counters', () => {
    const results = [
      {
        skipped: false,
        updated: 2,
        added: 1,
        ratingsUpdated: 1,
        bucketsUpserted: 3,
        snapshotsInserted: 1,
        snapshotsUnchanged: 0,
        snapshotsProcessed: 1,
      },
      {
        skipped: true,
        updated: 0,
        added: 2,
        ratingsUpdated: 0,
        bucketsUpserted: 0,
        snapshotsInserted: 0,
        snapshotsUnchanged: 1,
        snapshotsProcessed: 1,
        error: 'x',
      },
    ] as any;
    const stats = aggregateResults(results);
    expect(stats.total).toBe(2);
    expect(stats.skipped).toBe(1);
    expect(stats.updated).toBe(2);
    expect(stats.added).toBe(3);
    expect(stats.ratingsUpdated).toBe(1);
    expect(stats.bucketsUpserted).toBe(3);
    expect(stats.snapshotsInserted).toBe(1);
    expect(stats.snapshotsUnchanged).toBe(1);
    expect(stats.snapshotsProcessed).toBe(2);
    expect(stats.errors).toBe(1);
  });
});
