
import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleInsightsRepository } from './drizzle-insights.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';

// Mock Drizzle chain
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

describe('DrizzleInsightsRepository', () => {
  let repository: DrizzleInsightsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrizzleInsightsRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<DrizzleInsightsRepository>(DrizzleInsightsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMovements', () => {
    it('should calculate risers and fallers correctly', async () => {
      // Mock dates to have stable tests (though repo calculates dates internally, 
      // we just care about the mapping of returned rows)
      
      const today = new Date();
      today.setUTCHours(0,0,0,0);
      const todayStr = today.toISOString().split('T')[0];

      const prev = new Date(today);
      prev.setUTCDate(prev.getUTCDate() - 30);
      const prevStr = prev.toISOString().split('T')[0];

      const prev2 = new Date(today);
      prev2.setUTCDate(prev2.getUTCDate() - 60);
      const prev2Str = prev2.toISOString().split('T')[0];

      // Mock DB Response
      const mockRows = [
        // 1. Riser (Accelerating): 
        // Prev2 (10k) -> Prev (11k) = +1k
        // Prev (11k) -> Today (16k) = +5k
        // Delta = 5k - 1k = +4k
        {
          media: { 
            id: 'riser-id', 
            title: 'Riser Movie', 
            type: 'movie', 
            slug: 'riser', 
            posterPath: 'p.jpg', 
            backdropPath: 'b.jpg',
            rating: 8,
            voteCount: 100
          },
          snapshot: { snapshotDate: new Date(prev2Str), totalWatchers: 10000, region: 'global' }
        },
        {
          media: { id: 'riser-id' },
          snapshot: { snapshotDate: new Date(prevStr), totalWatchers: 11000, region: 'global' }
        },
        {
          media: { id: 'riser-id' },
          snapshot: { snapshotDate: new Date(todayStr), totalWatchers: 16000, region: 'global' }
        },

        // 2. Faller (Decelerating):
        // Prev2 (10k) -> Prev (15k) = +5k
        // Prev (15k) -> Today (16k) = +1k
        // Delta = 1k - 5k = -4k
        // Prev Growth = 5000 (>= 100 threshold)
        // Drop % = -4000 / 5000 = -80% (<= -10 threshold)
        {
          media: { 
            id: 'faller-id', 
            title: 'Faller Movie', 
            type: 'movie', 
            slug: 'faller', 
            posterPath: 'p.jpg', 
            backdropPath: 'b.jpg',
            rating: 7,
            voteCount: 200
          },
          snapshot: { snapshotDate: new Date(prev2Str), totalWatchers: 10000, region: 'global' }
        },
        {
          media: { id: 'faller-id' },
          snapshot: { snapshotDate: new Date(prevStr), totalWatchers: 15000, region: 'global' }
        },
        {
          media: { id: 'faller-id' },
          snapshot: { snapshotDate: new Date(todayStr), totalWatchers: 16000, region: 'global' }
        },

        // 3. New Item (No history)
        // Prev2 (0) -> Prev (0) = 0
        // Prev (0) -> Today (1000) = +1000
        // isNew = true
        {
          media: { 
            id: 'new-id', 
            title: 'New Movie', 
            type: 'movie', 
            slug: 'new', 
            posterPath: 'p.jpg', 
            backdropPath: 'b.jpg',
            rating: 6,
            voteCount: 50
          },
          snapshot: { snapshotDate: new Date(todayStr), totalWatchers: 1000, region: 'global' }
        },
      ];

      mockDb.where.mockResolvedValue(mockRows);

      const result = await repository.getMovements(30, 10);

      // Check Riser
      const riser = result.risers.find(r => r.id === 'riser-id');
      expect(riser).toBeDefined();
      expect(riser.stats.deltaWatchers).toBe(4000); // 5k - 1k
      expect(riser.stats.growthPrev).toBe(1000);
      expect(riser.stats.growthCurrent).toBe(5000);
      expect(riser.stats.isNew).toBe(false);

      // Check Faller
      const faller = result.fallers.find(r => r.id === 'faller-id');
      expect(faller).toBeDefined();
      expect(faller.stats.deltaWatchers).toBe(-4000); // 1k - 5k
      expect(faller.stats.growthPrev).toBe(5000);
      expect(faller.stats.growthCurrent).toBe(1000);
      expect(faller.stats.isNew).toBe(false);

      // Check New Item (Should be in Risers because growthCurrent > 0 and growthPrev=0, so delta = 1000 - 0 = 1000 > 0)
      const newItem = result.risers.find(r => r.id === 'new-id');
      expect(newItem).toBeDefined();
      expect(newItem.stats.deltaWatchers).toBe(1000);
      expect(newItem.stats.deltaPercent).toBeNull(); // Should be null, not 100
      expect(newItem.stats.isNew).toBe(true);
    });

    it('should filter out insignificant fallers', async () => {
      const today = new Date();
      today.setUTCHours(0,0,0,0);
      const todayStr = today.toISOString().split('T')[0];
      const prev = new Date(today);
      prev.setUTCDate(prev.getUTCDate() - 30);
      const prevStr = prev.toISOString().split('T')[0];
      const prev2 = new Date(today);
      prev2.setUTCDate(prev2.getUTCDate() - 60);
      const prev2Str = prev2.toISOString().split('T')[0];

      const mockRows = [
        // Insignificant Faller:
        // Prev2 (100) -> Prev (150) = +50 growth (Below threshold 100)
        // Prev (150) -> Today (180) = +30 growth
        // Delta = 30 - 50 = -20 (Deceleration)
        // Should be filtered out because prevGrowth (50) < 100
        {
          media: { id: 'tiny-id', title: 'Tiny', type: 'movie', slug: 'tiny', posterPath: null, backdropPath: null, rating: 5, voteCount: 10 },
          snapshot: { snapshotDate: new Date(prev2Str), totalWatchers: 100, region: 'global' }
        },
        {
          media: { id: 'tiny-id' },
          snapshot: { snapshotDate: new Date(prevStr), totalWatchers: 150, region: 'global' }
        },
        {
          media: { id: 'tiny-id' },
          snapshot: { snapshotDate: new Date(todayStr), totalWatchers: 180, region: 'global' }
        },
      ];

      mockDb.where.mockResolvedValue(mockRows);

      const result = await repository.getMovements(30, 10);

      expect(result.fallers).toHaveLength(0);
      expect(result.risers).toHaveLength(0); // Delta is negative, so not in risers either
    });
  });
});
