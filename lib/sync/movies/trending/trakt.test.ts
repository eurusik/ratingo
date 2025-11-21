import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTraktTrendingMovies, validateTraktMovieData, filterValidTraktMovies } from './trakt';

describe('movies/trending/trakt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).fetchTraktTrendingMovies = vi.fn();
  });

  it('fetchTraktTrendingMovies returns movies and respects limit', async () => {
    const validMovie = { movie: { ids: { tmdb: 1 }, title: 'A' }, watchers: 10 };
    vi.mocked((global as any).fetchTraktTrendingMovies).mockResolvedValue([validMovie]);
    const res = await fetchTraktTrendingMovies({ limit: 5, retries: 0 });
    expect(res).toEqual([validMovie]);
    expect((global as any).fetchTraktTrendingMovies).toHaveBeenCalledWith(5);
    expect((global as any).fetchTraktTrendingMovies).toHaveBeenCalledTimes(1);
  });

  it('fetchTraktTrendingMovies retries and throws after failures', async () => {
    vi.mocked((global as any).fetchTraktTrendingMovies).mockRejectedValue(new Error('fail'));
    await expect(fetchTraktTrendingMovies({ limit: 3, retries: 2, retryDelay: 0 })).rejects.toThrow(
      /після 3 спроб/i
    );
    expect((global as any).fetchTraktTrendingMovies).toHaveBeenCalledTimes(3);
  });

  it('fetchTraktTrendingMovies throws on invalid response shape', async () => {
    vi.mocked((global as any).fetchTraktTrendingMovies).mockResolvedValue({ not: 'array' } as any);
    await expect(fetchTraktTrendingMovies({ retries: 0 })).rejects.toThrow(/Невірний формат/i);
  });

  it('validateTraktMovieData validates correct shape', () => {
    const valid = { movie: { ids: { tmdb: 42 } }, watchers: 5 };
    const invalids = [
      null,
      {},
      { movie: {} },
      { movie: { ids: {} } },
      { movie: { ids: { tmdb: 'x' } } },
    ];
    expect(validateTraktMovieData(valid)).toBe(true);
    for (const inv of invalids) {
      expect(validateTraktMovieData(inv as any)).toBe(false);
    }
  });

  it('filterValidTraktMovies filters invalid entries', () => {
    const arr = [
      { movie: { ids: { tmdb: 1 } }, watchers: 10 },
      { movie: { ids: { tmdb: 'x' } } },
      null,
      {},
      { movie: { ids: { tmdb: 2 } }, watchers: 5 },
    ] as any[];
    const res = filterValidTraktMovies(arr);
    expect(res).toEqual([
      { movie: { ids: { tmdb: 1 } }, watchers: 10 },
      { movie: { ids: { tmdb: 2 } }, watchers: 5 },
    ]);
  });
});
