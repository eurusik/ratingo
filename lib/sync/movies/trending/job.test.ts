import { describe, it, expect, vi } from 'vitest';
import { createSyncJob, updateJobStats } from './job';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/db/schema', () => ({
  syncJobs: { id: { name: 'id' } },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return { ...original, eq: vi.fn((f: any, v: any) => ({ field: f.name, value: v })) };
});

import { db } from '@/db';

describe('movies/trending/job', () => {
  it('createSyncJob inserts job and returns id', async () => {
    vi.mocked(db.returning).mockResolvedValueOnce([{ id: 42 }] as any);
    const id = await createSyncJob();
    expect(db.insert).toHaveBeenCalled();
    expect(typeof id).toBe('number');
    expect(id).toBe(42);
  });

  it('updateJobStats updates job stats', async () => {
    await updateJobStats(7, 100, 95);
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.objectContaining({ trendingFetched: 100, tasksQueued: 95 }),
      })
    );
    expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ field: 'id', value: 7 }));
  });
});
