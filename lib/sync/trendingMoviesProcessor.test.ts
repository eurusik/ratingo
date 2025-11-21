import { describe, it, expect, vi } from 'vitest';

vi.mock('./movies/trending', () => ({
  runTrendingMoviesProcessor: vi.fn(() => 'ok'),
}));

describe('trendingMoviesProcessor facade', () => {
  it('re-exports runTrendingMoviesProcessor', async () => {
    const { runTrendingMoviesProcessor } = await import('./trendingMoviesProcessor');
    const res = runTrendingMoviesProcessor();
    expect(res).toBe('ok');
  });
});
