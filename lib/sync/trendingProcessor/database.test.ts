import { describe, it, expect, vi } from 'vitest';
import {
  fetchPendingTasks,
  updateTaskStatus,
  bulkUpdateTaskStatus,
  getTaskStats,
} from './database';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    groupBy: vi.fn(),
  },
}));

vi.mock('@/db/schema', () => ({
  syncTasks: {
    id: { name: 'id' },
    jobId: { name: 'job_id' },
    tmdbId: { name: 'tmdb_id' },
    payload: { name: 'payload' },
    attempts: { name: 'attempts' },
    status: { name: 'status' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    eq: vi.fn((f: any, v: any) => ({ field: f.name, value: v })),
    sql: vi.fn((..._args: any[]) => ({ expr: 'sql' })),
  };
});

import { db } from '@/db';

describe('trendingProcessor/database', () => {
  it('fetchPendingTasks clamps limit and filters by status', async () => {
    vi.mocked(db.limit).mockResolvedValueOnce([
      { id: 1, jobId: 10, tmdbId: 100, payload: {}, attempts: 0 },
      { id: 2, jobId: 10, tmdbId: 101, payload: {}, attempts: 1 },
    ] as any);
    const res = await fetchPendingTasks({ limit: 999, status: 'pending' } as any);
    expect(db.limit).toHaveBeenCalledWith(50);
    expect(res).toHaveLength(2);
  });

  it('updateTaskStatus sets processing increments attempts', async () => {
    const r = await updateTaskStatus(5, 'processing');
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', attempts: expect.any(Object) })
    );
    expect(r.success).toBe(true);
  });

  it('updateTaskStatus sets error with message', async () => {
    const r = await updateTaskStatus(5, 'error', 'oops');
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', lastError: 'oops' })
    );
    expect(r.success).toBe(true);
  });

  it('bulkUpdateTaskStatus updates multiple ids', async () => {
    const r = await bulkUpdateTaskStatus([1, 2, 3], 'processing');
    expect(r.success).toBe(true);
    expect(r.affectedRows).toBeGreaterThanOrEqual(0);
  });

  it('getTaskStats aggregates counts by status', async () => {
    vi.mocked(db.groupBy).mockResolvedValueOnce([
      { status: 'pending', count: 2 },
      { status: 'processing', count: 1 },
    ] as any);
    const stats = await getTaskStats();
    expect(stats.pending).toBe(2);
    expect(stats.processing).toBe(1);
    expect(stats.done).toBe(0);
    expect(stats.error).toBe(0);
  });
});
