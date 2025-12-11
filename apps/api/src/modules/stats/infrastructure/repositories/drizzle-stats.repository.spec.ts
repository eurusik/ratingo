import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleStatsRepository } from './drizzle-stats.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';

describe('DrizzleStatsRepository', () => {
  let repository: DrizzleStatsRepository;

  const createMockDb = (options: { resolveWith?: any; rejectWith?: Error } = {}) => {
    // Create a thenable object that resolves/rejects when awaited
    const createThenable = () => {
      const thenable: any = {};
      
      // All chain methods return the same thenable
      const chainMethods = ['from', 'where', 'limit', 'innerJoin', 'values', 'onConflictDoUpdate'];
      chainMethods.forEach(method => {
        thenable[method] = jest.fn().mockReturnValue(thenable);
      });

      // Make it thenable (awaitable)
      if (options.rejectWith) {
        thenable.then = function(onFulfilled: any, onRejected: any) {
          return Promise.reject(options.rejectWith).then(onFulfilled, onRejected);
        };
      } else {
        thenable.then = function(onFulfilled: any, onRejected: any) {
          return Promise.resolve(options.resolveWith ?? []).then(onFulfilled, onRejected);
        };
      }

      return thenable;
    };

    const thenable = createThenable();

    // Root db methods that start the chain
    return {
      select: jest.fn().mockReturnValue(thenable),
      insert: jest.fn().mockReturnValue(thenable),
    };
  };

  describe('upsert', () => {
    it('should upsert stats successfully', async () => {
      const mockDb = createMockDb();
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const stats = { mediaItemId: 'media-1', watchersCount: 100 };
      await repository.upsert(stats);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.upsert({ mediaItemId: '1', watchersCount: 0 }))
        .rejects.toThrow(DatabaseException);
    });
  });

  describe('bulkUpsert', () => {
    it('should upsert multiple stats', async () => {
      const mockDb = createMockDb();
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const stats = [
        { mediaItemId: '1', watchersCount: 100 },
        { mediaItemId: '2', watchersCount: 200 },
      ];
      await repository.bulkUpsert(stats);

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should return early if array is empty', async () => {
      const mockDb = createMockDb();
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await repository.bulkUpsert([]);
      
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.bulkUpsert([{ mediaItemId: '1', watchersCount: 0 }]))
        .rejects.toThrow(DatabaseException);
    });
  });

  describe('findByMediaItemId', () => {
    it('should return stats if found', async () => {
      const mockResult = [{ mediaItemId: 'media-1', watchersCount: 100, trendingRank: 5, popularity24h: 50 }];
      const mockDb = createMockDb({ resolveWith: mockResult });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByMediaItemId('media-1');

      expect(result).toEqual({
        mediaItemId: 'media-1',
        watchersCount: 100,
        trendingRank: 5,
        popularity24h: 50,
      });
    });

    it('should return null if not found', async () => {
      const mockDb = createMockDb({ resolveWith: [] });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByMediaItemId('non-existent');
      
      expect(result).toBeNull();
    });

    it('should handle null values gracefully', async () => {
      const mockResult = [{ mediaItemId: 'media-1', watchersCount: null, trendingRank: null, popularity24h: null }];
      const mockDb = createMockDb({ resolveWith: mockResult });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByMediaItemId('media-1');

      expect(result).toEqual({
        mediaItemId: 'media-1',
        watchersCount: 0,
        trendingRank: undefined,
        popularity24h: undefined,
      });
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.findByMediaItemId('1'))
        .rejects.toThrow(DatabaseException);
    });
  });

  describe('findByTmdbId', () => {
    it('should return stats if found', async () => {
      const mockResult = [{ mediaItemId: 'media-1', watchersCount: 200, trendingRank: 3, popularity24h: 80 }];
      const mockDb = createMockDb({ resolveWith: mockResult });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByTmdbId(550);

      expect(result).toEqual({
        mediaItemId: 'media-1',
        watchersCount: 200,
        trendingRank: 3,
        popularity24h: 80,
      });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null if not found', async () => {
      const mockDb = createMockDb({ resolveWith: [] });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByTmdbId(999999);
      
      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleStatsRepository,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.findByTmdbId(550))
        .rejects.toThrow(DatabaseException);
    });
  });
});
