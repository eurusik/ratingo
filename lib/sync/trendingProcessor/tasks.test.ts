import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  transformToTraktItem,
  calculateMaxWatchers,
  processTrendingTask,
  createRetryLabelHandler,
} from './tasks';
import { processShow } from '@/lib/sync/shows/processing';

vi.mock('@/lib/sync/shows/processing', () => ({
  processShow: vi.fn(),
}));

describe('trendingProcessor/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transformToTraktItem формує watchers та show з фолбеком tmdbId', () => {
    const payload = { watchers: 'not-number', traktShow: { ids: { tmdb: 777 }, title: 'S' } };
    const r1 = transformToTraktItem(payload, 123);
    expect(r1.watchers).toBeUndefined();
    expect(r1.show).toEqual({ ids: { tmdb: 777 }, title: 'S' });

    const r2 = transformToTraktItem({}, 456);
    expect(r2.watchers).toBeUndefined();
    expect(r2.show).toEqual({ ids: { tmdb: 456 }, title: null });
  });

  it('calculateMaxWatchers обирає максимум між порогом та watchers', () => {
    expect(calculateMaxWatchers(undefined, 10000)).toBe(10000);
    expect(calculateMaxWatchers(5000, 10000)).toBe(10000);
    expect(calculateMaxWatchers(15000, 10000)).toBe(15000);
  });

  it('processTrendingTask успішно делегує до processShow з коректними параметрами', async () => {
    vi.mocked(processShow).mockResolvedValue({ skipped: false, updated: 1, added: 0 });

    const task = { payload: { watchers: 120, traktShow: { ids: { tmdb: 999 } } }, tmdbId: 999 };
    const config = {
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      cache: {
        details: new Map(),
        translations: new Map(),
        providers: new Map(),
        contentRatings: new Map(),
        externalIds: new Map(),
        currentTrending: new Set([999]),
      },
      maxWatchers: 10000,
    } as any;

    const res = await processTrendingTask(task, config);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(processShow).toHaveBeenCalledTimes(1);
    const [traktItem, options] = vi.mocked(processShow).mock.calls[0];
    expect(traktItem.show.ids.tmdb).toBe(999);
    expect(options.maxWatchers).toBe(10000); // watchers=120 < threshold
    expect(options.tmdbDetailsCache).toBe(config.cache.details);
    expect(options.tmdbTranslationCache).toBe(config.cache.translations);
    expect(options.tmdbProvidersCache).toBe(config.cache.providers);
    expect(options.tmdbExternalIdsCache).toBe(config.cache.externalIds);
  });

  it('processTrendingTask повертає помилку якщо processShow повернув error', async () => {
    vi.mocked(processShow).mockResolvedValue({ error: 'fail', skipped: true });
    const res = await processTrendingTask({ payload: {}, tmdbId: 1 }, {
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      cache: {
        details: new Map(),
        translations: new Map(),
        providers: new Map(),
        contentRatings: new Map(),
        externalIds: new Map(),
        currentTrending: new Set(),
      },
      maxWatchers: 10000,
    } as any);
    expect(res.success).toBe(false);
    expect(res.error).toBe('fail');
  });

  it('createRetryLabelHandler повертає функцію-логер', () => {
    const handler = createRetryLabelHandler('TMDB API');
    expect(typeof handler).toBe('function');
    // Перевіряємо, що виклик не кидає помилок
    handler(2, new Error('x'));
  });
});
