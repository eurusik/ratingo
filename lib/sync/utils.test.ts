import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { asyncPool, withRetry, LRUCache, cachedWithRetry, toWatchersMap, timeAsync } from './utils';

// Helper to introduce a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('asyncPool', () => {
  it('should process all items in the array', async () => {
    const items = [1, 2, 3, 4, 5];
    const iteratorFn = vi.fn(async (item: number) => {
      await delay(10);
      return item * 2;
    });

    const results = await asyncPool(2, items, iteratorFn);

    expect(iteratorFn).toHaveBeenCalledTimes(items.length);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should run with limited concurrency', async () => {
    const items = [1, 2, 3, 4, 5, 6];
    let concurrentCount = 0;
    let maxConcurrentCount = 0;

    const iteratorFn = async (item: number) => {
      concurrentCount++;
      maxConcurrentCount = Math.max(maxConcurrentCount, concurrentCount);
      await delay(20);
      concurrentCount--;
      return item;
    };

    await asyncPool(3, items, iteratorFn);

    expect(maxConcurrentCount).toBe(3);
  });

  it('should return results in the correct order', async () => {
    const items = [1, 2, 3];
    const iteratorFn = async (item: number) => {
      if (item === 1) await delay(30);
      if (item === 2) await delay(20);
      if (item === 3) await delay(10);
      return item;
    };
    const results = await asyncPool(3, items, iteratorFn);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle an empty array', async () => {
    const results = await asyncPool(3, [], async () => 'should not run');
    expect(results).toEqual([]);
  });
});

describe('withRetry', () => {
  it('should return value on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, 3);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw an error after all retries fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, 2, 10)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail 1')).mockResolvedValue('success');
    const onRetry = vi.fn();

    await withRetry(fn, 2, 10, onRetry);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

describe('LRUCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set and get a value', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should evict the least recently used item', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // 'a' should be evicted

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('should make an item the most recently used on get', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // 'a' is now the most recent
    cache.set('d', 4); // 'b' should be evicted

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
  });

  it('should handle TTL correctly', () => {
    const cache = new LRUCache<string, number>(3, 1000);
    cache.set('a', 1);

    vi.advanceTimersByTime(500);
    expect(cache.get('a')).toBe(1);

    vi.advanceTimersByTime(501);
    expect(cache.get('a')).toBeUndefined();
  });

  it('should use custom TTL for an item', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1, 500);

    vi.advanceTimersByTime(501);
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('cachedWithRetry', () => {
  it('should return cached value if present', async () => {
    const cache = new LRUCache<string, string>();
    cache.set('key', 'cached-value');
    const fn = vi.fn();

    const result = await cachedWithRetry(cache, 'key', 'test', fn);

    expect(result).toBe('cached-value');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should call function, cache and return value if not cached', async () => {
    const cache = new LRUCache<string, string>();
    const fn = vi.fn().mockResolvedValue('new-value');

    const result = await cachedWithRetry(cache, 'key', 'test', fn);

    expect(result).toBe('new-value');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cache.get('key')).toBe('new-value');
  });
});

describe('toWatchersMap', () => {
  it('should convert a list to a watchers map', () => {
    const list = [
      { show: { ids: { tmdb: 1 } }, watchers: 10 },
      { show: { ids: { tmdb: 2 } }, watchers: 20 },
    ];
    const result = toWatchersMap(list);
    expect(result).toEqual({ 1: 10, 2: 20 });
  });

  it('should handle items with missing data', () => {
    const list = [
      { show: { ids: { tmdb: 1 } }, watchers: 10 },
      { show: { ids: {} }, watchers: 20 }, // missing tmdb
      { show: { ids: { tmdb: 3 } } }, // missing watchers
      { show: null },
    ];
    const result = toWatchersMap(list);
    expect(result).toEqual({ 1: 10 });
  });

  it('should handle empty and invalid input', () => {
    expect(toWatchersMap([])).toEqual({});
    expect(toWatchersMap(null as any)).toEqual({});
    expect(toWatchersMap({} as any)).toEqual({});
  });
});

describe('timeAsync', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the function result', async () => {
    const result = await timeAsync('test', async () => {
      await delay(10);
      return 'done';
    });
    expect(result).toBe('done');
  });

  it('should log a warning if threshold is exceeded', async () => {
    await timeAsync('long-test', async () => await delay(50), 30);
    expect(console.warn).toHaveBeenCalled();
  });

  it('should not log a warning if threshold is not exceeded', async () => {
    await timeAsync('short-test', async () => await delay(10), 30);
    expect(console.warn).not.toHaveBeenCalled();
  });
});
