import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPendingTasks,
  updateTaskToProcessing,
  updateTaskToDone,
  updateTaskToError,
  createTasksBatch,
} from './tasks';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
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
  syncJobs: { id: { name: 'id' }, type: { name: 'type' } },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    eq: vi.fn((f: any, v: any) => ({ field: f.name, value: v })),
    and: vi.fn((...args: any[]) => args),
  };
});

import { db } from '@/db';

describe('shows/trending/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPendingTasks clamps limit and maps rows', async () => {
    vi.mocked(db.limit).mockResolvedValueOnce([
      { id: 1, jobId: 10, tmdbId: 100, payload: { a: 1 }, attempts: 0 },
      { id: 2, jobId: 10, tmdbId: 101, payload: { a: 2 }, attempts: 1 },
    ] as any);
    const rows = await getPendingTasks(999);
    expect(db.limit).toHaveBeenCalledWith(50);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ status: 'pending' });
  });

  it('updateTaskToProcessing sets status and increments attempts', async () => {
    await updateTaskToProcessing(5, 2);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', attempts: 3 })
    );
  });

  it('updateTaskToDone sets status completed', async () => {
    await updateTaskToDone(5);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('updateTaskToError sets status error and message', async () => {
    await updateTaskToError(5, 'fail');
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', lastError: 'fail' })
    );
  });

  it('createTasksBatch returns enriched tasks', async () => {
    const items = [{ jobId: 1, tmdbId: 100, payload: { x: 1 } } as any];
    const res = await createTasksBatch(items as any);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ status: 'pending', jobId: 1, tmdbId: 100 });
    expect(typeof res[0].id).toBe('number');
  });
});
