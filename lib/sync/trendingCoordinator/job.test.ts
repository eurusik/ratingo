import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('trendingCoordinator/job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSyncJob inserts and returns id', async () => {
    vi.mocked(db.returning).mockResolvedValueOnce([{ id: 77 }]);
    const id = await createSyncJob();
    expect(id).toBe(77);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('updateJobStats updates job stats', async () => {
    await updateJobStats(77, 10, 8);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledTimes(1);
    expect(db.where).toHaveBeenCalledTimes(1);
  });
});
