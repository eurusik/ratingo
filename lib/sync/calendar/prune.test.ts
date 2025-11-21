import { describe, it, expect, vi } from 'vitest';
import { pruneStaleAirings } from './prune';
import { db } from '@/db';
import { showAirings } from '@/db/schema';
import { lt, eq, sql } from 'drizzle-orm';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/db/schema', () => ({
  showAirings: {
    id: { name: 'id' },
    airDate: { name: 'air_date' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    lt: vi.fn((field, value) => ({ field: field.name, value, op: 'lt' })),
    eq: vi.fn((field, value) => ({ field: field.name, value, op: 'eq' })),
    sql: vi.fn((strings: TemplateStringsArray, ...vals: any[]) => vals[0]),
  };
});

describe('calendar/prune', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-31T00:00:00.000Z'));
    vi.mocked(db.select).mockClear();
    vi.mocked(db.from).mockClear().mockReturnThis();
    vi.mocked(db.where).mockClear().mockReturnThis();
    vi.mocked(db.delete).mockClear().mockReturnThis();
    vi.mocked(lt).mockClear();
    vi.mocked(eq).mockClear();
    vi.mocked(sql).mockClear();
  });

  it('видаляє застарілі ефіри та повертає кількість', async () => {
    const expectedCutoff = new Date('2025-01-01T00:00:00.000Z').toISOString();
    const builder: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 10 }, { id: 20 }]),
    };
    vi.mocked(db.select).mockReturnValue(builder);

    const res = await pruneStaleAirings();

    expect(res.deleted).toBe(2);
    expect(res.cutoffDate).toBe(expectedCutoff);
    expect(db.select).toHaveBeenCalledWith({ id: showAirings.id });
    expect(builder.from).toHaveBeenCalledWith(showAirings);
    expect(lt).toHaveBeenCalledWith(showAirings.airDate, expectedCutoff);
    expect(db.delete).toHaveBeenCalledWith(showAirings);
    expect(eq).toHaveBeenCalledWith(showAirings.id, 10);
    expect(eq).toHaveBeenCalledWith(showAirings.id, 20);
  });

  it('нічого не видаляє, коли застарілих ефірів немає', async () => {
    const expectedCutoff = new Date('2025-01-01T00:00:00.000Z').toISOString();
    const builder: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(builder);

    const res = await pruneStaleAirings();

    expect(res.deleted).toBe(0);
    expect(res.cutoffDate).toBe(expectedCutoff);
    expect(db.delete).not.toHaveBeenCalled();
  });
});
