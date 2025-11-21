import { describe, it, expect, vi } from 'vitest';
import { initializeCaches, getMonthlyMaps } from './cache';

describe('movies/trending/cache', () => {
  it('initializeCaches returns working caches', () => {
    const c = initializeCaches();
    c.tmdbDetailsCache.set(1, { id: 1 });
    expect(c.tmdbDetailsCache.get(1)).toEqual({ id: 1 });
    c.tmdbTranslationCache.set(2, { titleUk: 'x' });
    expect(c.tmdbTranslationCache.get(2)).toEqual({ titleUk: 'x' });
    c.tmdbProvidersCache.set('1|UA', [{ id: 8 }]);
    expect(c.tmdbProvidersCache.get('1|UA')).toEqual([{ id: 8 }]);
    c.tmdbExternalIdsCache.set(3, { imdb_id: 'tt3' });
    expect(c.tmdbExternalIdsCache.get(3)).toEqual({ imdb_id: 'tt3' });
  });

  it('getMonthlyMaps delegates to monthly module', async () => {
    vi.mock('@/lib/sync/monthly', () => ({
      buildMonthlyMapsMovies: vi.fn(async () => ({
        m0: {},
        m1: {},
        m2: {},
        m3: {},
        m4: {},
        m5: {},
      })),
    }));
    const maps = await getMonthlyMaps();
    expect(maps).toHaveProperty('m0');
    expect(maps).toHaveProperty('m5');
  });
});
