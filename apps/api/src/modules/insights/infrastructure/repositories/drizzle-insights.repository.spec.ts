import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DrizzleInsightsRepository } from './drizzle-insights.repository';

// Mock Drizzle chain
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

const WINDOW = 30;

function dates() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const prev = new Date(today);
  prev.setUTCDate(prev.getUTCDate() - WINDOW);
  const prev2 = new Date(today);
  prev2.setUTCDate(prev2.getUTCDate() - WINDOW * 2);
  return { today, prev, prev2 };
}

function media(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: id,
    originalTitle: null,
    type: 'movie',
    slug: id,
    posterPath: 'p.jpg',
    backdropPath: 'b.jpg',
    rating: 7,
    voteCount: 100,
    ...extra,
  };
}

/** Flat row as returned by the (column-selecting) insights query. */
function row(id: string, snapshotDate: Date, totalWatchers: number) {
  return { ...media(id), snapshotDate, totalWatchers };
}

describe('DrizzleInsightsRepository', () => {
  let repository: DrizzleInsightsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DrizzleInsightsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    repository = module.get<DrizzleInsightsRepository>(DrizzleInsightsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMovements', () => {
    it('should calculate risers and fallers correctly', async () => {
      const { today, prev, prev2 } = dates();

      mockDb.where.mockResolvedValue([
        // Riser (accelerating): +1k then +5k => delta +4k
        row('riser-id', prev2, 10000),
        row('riser-id', prev, 11000),
        row('riser-id', today, 16000),
        // Faller (decelerating): +5k then +1k => delta -4k, -80%
        row('faller-id', prev2, 10000),
        row('faller-id', prev, 15000),
        row('faller-id', today, 16000),
        // New entrant: zeros before, +1000 now
        row('new-id', prev2, 0),
        row('new-id', prev, 0),
        row('new-id', today, 1000),
      ]);

      const result = await repository.getMovements(WINDOW, 10);

      const riser = result.risers.find((r) => r.id === 'riser-id');
      expect(riser).toBeDefined();
      expect(riser!.stats.deltaWatchers).toBe(4000);
      expect(riser!.stats.growthPrev).toBe(1000);
      expect(riser!.stats.growthCurrent).toBe(5000);
      expect(riser!.stats.isNewInTrends).toBe(false);

      const faller = result.fallers.find((r) => r.id === 'faller-id');
      expect(faller).toBeDefined();
      expect(faller!.stats.deltaWatchers).toBe(-4000);
      expect(faller!.stats.growthPrev).toBe(5000);
      expect(faller!.stats.growthCurrent).toBe(1000);
      expect(faller!.stats.isNewInTrends).toBe(false);

      const newItem = result.risers.find((r) => r.id === 'new-id');
      expect(newItem).toBeDefined();
      expect(newItem!.stats.deltaWatchers).toBe(1000);
      expect(newItem!.stats.deltaPercent).toBeNull();
      expect(newItem!.stats.isNewInTrends).toBe(true);
    });

    it('should filter out insignificant fallers', async () => {
      const { today, prev, prev2 } = dates();

      // prevGrowth = 50 (< 100 threshold), delta = -20 => filtered out
      mockDb.where.mockResolvedValue([
        row('tiny-id', prev2, 100),
        row('tiny-id', prev, 150),
        row('tiny-id', today, 180),
      ]);

      const result = await repository.getMovements(WINDOW, 10);

      expect(result.fallers).toHaveLength(0);
      expect(result.risers).toHaveLength(0);
    });

    it('should skip items with a missing snapshot instead of treating it as 0', async () => {
      const { today, prev, prev2 } = dates();

      mockDb.where.mockResolvedValue([
        // Only today's lifetime total: must NOT look like +50k growth
        row('only-today', today, 50000),
        // Missing the middle snapshot
        row('no-prev', prev2, 1000),
        row('no-prev', today, 90000),
        // Missing the oldest snapshot
        row('no-prev2', prev, 1000),
        row('no-prev2', today, 90000),
        // Complete
        row('complete', prev2, 1000),
        row('complete', prev, 1100),
        row('complete', today, 1500),
      ]);

      const result = await repository.getMovements(WINDOW, 10);
      const ids = [...result.risers, ...result.fallers].map((i) => i.id);

      expect(ids).toEqual(['complete']);
    });

    it('should propagate database errors as DatabaseException', async () => {
      mockDb.where.mockRejectedValue(new Error('boom'));

      await expect(repository.getMovements(WINDOW, 10)).rejects.toMatchObject({
        message: expect.stringContaining('insights movements'),
      });
    });
  });
});
