import { describe, it, expect, vi } from 'vitest';

describe('trending aggregator', () => {
  it('falls back to runTrendingProcessor when runTrendingSync is missing', async () => {
    vi.resetModules();
    vi.mock('./trending/index', () => ({
      runTrendingProcessor: vi.fn(async () => ({
        success: true,
        processed: 3,
        succeeded: 3,
        failed: 0,
      })),
    }));
    const { runTrendingSync } = await import('./trending');
    const res = await runTrendingSync();
    expect(res.success).toBe(true);
    expect(typeof res.totals.trendingFetched).toBe('number');
    expect(res.updated).toBe(res.totals.trendingFetched);
    expect(res.skipped).toBe(0);
    expect(res.errorCount).toBe(0);
  });
});
