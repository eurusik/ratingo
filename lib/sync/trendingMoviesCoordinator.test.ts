import { describe, it, expect, vi } from 'vitest';

vi.mock('./movies/trending', () => ({
  runTrendingMoviesCoordinator: vi.fn(() => 'ok'),
}));

describe('trendingMoviesCoordinator facade', () => {
  it('re-exports runTrendingMoviesCoordinator', async () => {
    const { runTrendingMoviesCoordinator } = await import('./trendingMoviesCoordinator');
    const res = runTrendingMoviesCoordinator();
    expect(res).toBe('ok');
  });
});
