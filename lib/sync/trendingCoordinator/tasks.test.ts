import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTasksBatch } from './tasks';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(),
  },
}));

vi.mock('@/db/schema', () => ({
  syncTasks: {},
}));

import { db } from '@/db';

describe('trendingCoordinator/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createTasksBatch returns 0 when empty', async () => {
    const res = await createTasksBatch([]);
    expect(res).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('createTasksBatch bulk inserts and returns count', async () => {
    vi.mocked(db.values).mockResolvedValueOnce(undefined as any);
    const items = [{ a: 1 }, { a: 2 }];
    const res = await createTasksBatch(items as any);
    expect(res).toBe(items.length);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('createTasksBatch falls back to individual inserts on error', async () => {
    vi.mocked(db.values).mockRejectedValueOnce(new Error('dup'));
    const insertSpy = vi.mocked(db.insert);
    vi.mocked(db.values).mockResolvedValue(undefined as any);
    const items = [{ a: 1 }, { a: 2 }];
    const res = await createTasksBatch(items as any);
    expect(insertSpy).toHaveBeenCalledTimes(3);
    expect(res).toBe(items.length);
  });
});
