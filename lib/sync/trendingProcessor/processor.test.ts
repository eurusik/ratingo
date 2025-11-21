import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTrendingProcessor } from './processor';
import { buildMonthlyMaps } from '@/lib/sync/monthly';
import { asyncPool } from '@/lib/sync/utils';
import { createTrendingCache } from './caches';
import { processTrendingTask } from './tasks';
import { fetchPendingTasks, updateTaskStatus } from './database';

vi.mock('@/lib/sync/monthly', () => ({
  buildMonthlyMaps: vi.fn(async () => ({ m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} })),
}));

vi.mock('@/lib/sync/utils', () => ({
  asyncPool: vi.fn(async (_concurrency, items, mapper) => Promise.all(items.map(mapper))),
}));

vi.mock('./caches', () => ({
  createTrendingCache: vi.fn(() => ({
    details: {},
    translations: {},
    providers: {},
    externalIds: {},
  })),
}));

vi.mock('./tasks', () => ({
  processTrendingTask: vi.fn(),
}));

vi.mock('./database', () => ({
  fetchPendingTasks: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

describe('trendingProcessor/processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('повертає порожній результат коли немає задач', async () => {
    vi.mocked(fetchPendingTasks).mockResolvedValue([]);
    const res = await runTrendingProcessor({ limit: 5, concurrency: 2 });
    expect(res).toEqual({ success: true, processed: 0, succeeded: 0, failed: 0 });
    expect(fetchPendingTasks).toHaveBeenCalledWith({ limit: 5 });
    expect(updateTaskStatus).not.toHaveBeenCalled();
  });

  it('обробляє успішні задачі та оновлює статуси', async () => {
    const tasks = [
      { id: 1, tmdbId: 101, payload: { a: 1 } },
      { id: 2, tmdbId: 102, payload: { a: 2 } },
    ];
    vi.mocked(fetchPendingTasks).mockResolvedValue(tasks as any);
    vi.mocked(processTrendingTask).mockResolvedValue({ success: true });

    const res = await runTrendingProcessor({ limit: 2, concurrency: 2 });

    expect(res).toEqual({ success: true, processed: 2, succeeded: 2, failed: 0 });
    expect(updateTaskStatus).toHaveBeenCalledWith(1, 'processing');
    expect(updateTaskStatus).toHaveBeenCalledWith(1, 'done');
    expect(updateTaskStatus).toHaveBeenCalledWith(2, 'processing');
    expect(updateTaskStatus).toHaveBeenCalledWith(2, 'done');
  });

  it('фіксує помилки задач і виставляє status=error з повідомленням', async () => {
    const tasks = [
      { id: 10, tmdbId: 201, payload: {} },
      { id: 20, tmdbId: 202, payload: {} },
    ];
    vi.mocked(fetchPendingTasks).mockResolvedValue(tasks as any);
    vi.mocked(processTrendingTask)
      .mockResolvedValueOnce({ success: false, error: 'fail A' })
      .mockResolvedValueOnce({ success: true });

    const res = await runTrendingProcessor({ limit: 2, concurrency: 2 });

    expect(res).toEqual({ success: true, processed: 2, succeeded: 1, failed: 1 });
    expect(updateTaskStatus).toHaveBeenCalledWith(10, 'processing');
    expect(updateTaskStatus).toHaveBeenCalledWith(10, 'error', 'fail A');
    expect(updateTaskStatus).toHaveBeenCalledWith(20, 'processing');
    expect(updateTaskStatus).toHaveBeenCalledWith(20, 'done');
  });
});
