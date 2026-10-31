import { Test, TestingModule } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { MediaType } from '@/common/enums/media-type.enum';
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
      chainMethods.forEach((method) => {
        thenable[method] = jest.fn().mockReturnValue(thenable);
      });

      // Make it thenable (awaitable)
      if (options.rejectWith) {
        thenable.then = function (onFulfilled: any, onRejected: any) {
          return Promise.reject(options.rejectWith).then(onFulfilled, onRejected);
        };
      } else {
        thenable.then = function (onFulfilled: any, onRejected: any) {
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
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const stats = { mediaItemId: 'media-1', watchersCount: 100 };
      await repository.upsert(stats);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should map undefined optional fields to null to prevent Drizzle default substitution', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      // Simulate trending sync: only watchersCount provided, community fields omitted
      await repository.upsert({ mediaItemId: 'media-1', watchersCount: 42 });

      const thenable = mockDb.insert.mock.results[0].value;
      const valuesArg = thenable.values.mock.calls[0][0];

      expect(valuesArg.communityRatingCount).toBeNull();
      expect(valuesArg.communityAverageRating).toBeNull();
      expect(valuesArg.trendingRank).toBeNull();
      expect(valuesArg.popularity24h).toBeNull();
      expect(valuesArg.ratingoScore).toBeNull();
      // Explicitly provided value should pass through unchanged
      expect(valuesArg.watchersCount).toBe(42);
    });

    it('should pass explicit zero through unchanged', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      // Simulate community rating reset: explicit 0 should NOT become null
      await repository.upsert({
        mediaItemId: 'media-1',
        communityAverageRating: 0,
        communityRatingCount: 0,
      });

      const thenable = mockDb.insert.mock.results[0].value;
      const valuesArg = thenable.values.mock.calls[0][0];

      expect(valuesArg.communityRatingCount).toBe(0);
      expect(valuesArg.communityAverageRating).toBe(0);
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.upsert({ mediaItemId: '1', watchersCount: 0 })).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('bulkUpsert', () => {
    it('should upsert multiple stats in a single batch', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const stats = [
        { mediaItemId: '1', watchersCount: 100 },
        { mediaItemId: '2', watchersCount: 200 },
      ];
      await repository.bulkUpsert(stats);

      // Should use single batch INSERT instead of N individual inserts
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should map undefined optional fields to null to prevent Drizzle default substitution', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      // Simulate trending sync: only watchersCount and scores provided,
      // communityRatingCount is undefined (should NOT become 0)
      await repository.bulkUpsert([
        { mediaItemId: 'media-1', watchersCount: 42, ratingoScore: 85 },
      ]);

      const thenable = mockDb.insert.mock.results[0].value;
      const valuesArg = thenable.values.mock.calls[0][0];

      expect(valuesArg[0].communityRatingCount).toBeNull();
      expect(valuesArg[0].communityAverageRating).toBeNull();
      expect(valuesArg[0].trendingRank).toBeNull();
      expect(valuesArg[0].popularity24h).toBeNull();
      expect(valuesArg[0].freshnessScore).toBeNull();
      // Explicitly provided values should pass through unchanged
      expect(valuesArg[0].watchersCount).toBe(42);
      expect(valuesArg[0].ratingoScore).toBe(85);
    });

    it('should pass explicit zero through unchanged', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      // Simulate community rating stale reset: explicit 0 should NOT become null
      await repository.bulkUpsert([
        { mediaItemId: 'media-1', communityAverageRating: 0, communityRatingCount: 0 },
      ]);

      const thenable = mockDb.insert.mock.results[0].value;
      const valuesArg = thenable.values.mock.calls[0][0];

      expect(valuesArg[0].communityRatingCount).toBe(0);
      expect(valuesArg[0].communityAverageRating).toBe(0);
    });

    it('should merge rows with the same mediaItemId (Postgres rejects duplicate conflict targets)', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await repository.bulkUpsert([
        { mediaItemId: 'media-1', watchersCount: 10, trendingRank: 3 },
        { mediaItemId: 'media-2', watchersCount: 20 },
        { mediaItemId: 'media-1', watchersCount: 99, ratingoScore: 70 },
      ]);

      const thenable = mockDb.insert.mock.results[0].value;
      const valuesArg = thenable.values.mock.calls[0][0];

      expect(valuesArg).toHaveLength(2);
      const merged = valuesArg.find((v: any) => v.mediaItemId === 'media-1');
      // Later defined fields win; earlier fields not overridden are kept
      expect(merged.watchersCount).toBe(99);
      expect(merged.trendingRank).toBe(3);
      expect(merged.ratingoScore).toBe(70);
    });

    it('should return early if array is empty', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await repository.bulkUpsert([]);

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should split large batches into chunks of 500 rows (bind-param limit)', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const stats = Array.from({ length: 1100 }, (_, i) => ({
        mediaItemId: `id-${i}`,
        watchersCount: i,
      }));
      await repository.bulkUpsert(stats);

      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.bulkUpsert([{ mediaItemId: '1', watchersCount: 0 }])).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('findByMediaItemId', () => {
    it('should return stats if found', async () => {
      const mockResult = [
        {
          mediaItemId: 'media-1',
          watchersCount: 100,
          trendingRank: 5,
          popularity24h: 50,
          communityAverageRating: 75.5,
          communityRatingCount: 10,
        },
      ];
      const mockDb = createMockDb({ resolveWith: mockResult });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByMediaItemId('media-1');

      expect(result).toEqual({
        mediaItemId: 'media-1',
        watchersCount: 100,
        trendingRank: 5,
        popularity24h: 50,
        communityAverageRating: 75.5,
        communityRatingCount: 10,
      });
    });

    it('should return null if not found', async () => {
      const mockDb = createMockDb({ resolveWith: [] });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByMediaItemId('non-existent');

      expect(result).toBeNull();
    });

    it('should handle null values gracefully', async () => {
      const mockResult = [
        {
          mediaItemId: 'media-1',
          watchersCount: null,
          trendingRank: null,
          popularity24h: null,
          communityAverageRating: null,
          communityRatingCount: null,
        },
      ];
      const mockDb = createMockDb({ resolveWith: mockResult });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByMediaItemId('media-1');

      expect(result).toEqual({
        mediaItemId: 'media-1',
        watchersCount: 0,
        trendingRank: undefined,
        popularity24h: undefined,
        communityAverageRating: undefined,
        communityRatingCount: undefined,
      });
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.findByMediaItemId('1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findByTmdbId', () => {
    it('should return stats if found', async () => {
      const mockResult = [
        {
          mediaItemId: 'media-1',
          watchersCount: 200,
          trendingRank: 3,
          popularity24h: 80,
          communityAverageRating: 80,
          communityRatingCount: 15,
        },
      ];
      const mockDb = createMockDb({ resolveWith: mockResult });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByTmdbId(550);

      expect(result).toEqual({
        mediaItemId: 'media-1',
        watchersCount: 200,
        trendingRank: 3,
        popularity24h: 80,
        communityAverageRating: 80,
        communityRatingCount: 15,
      });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should filter by media type when provided', async () => {
      const mockDb = createMockDb({ resolveWith: [{ mediaItemId: 'show-1', watchersCount: 5 }] });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByTmdbId(550, MediaType.SHOW);

      expect(result?.mediaItemId).toBe('show-1');
      // where() receives a composite (tmdb_id AND type) condition
      const thenable = mockDb.select.mock.results[0].value;
      const whereArg = thenable.where.mock.calls[0][0];
      const dialect = new PgDialect();
      const { sql: whereSql, params } = dialect.sqlToQuery(whereArg);
      expect(whereSql).toContain('"type"');
      expect(params).toEqual(expect.arrayContaining([550, MediaType.SHOW]));
    });

    it('should return null if not found', async () => {
      const mockDb = createMockDb({ resolveWith: [] });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      const result = await repository.findByTmdbId(999999);

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.findByTmdbId(550)).rejects.toThrow(DatabaseException);
    });
  });

  describe('updateTotalWatchers', () => {
    it('should upsert total watchers successfully', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await repository.updateTotalWatchers('media-1', 5000);

      // Should use INSERT ... ON CONFLICT (upsert pattern)
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.updateTotalWatchers('media-1', 5000)).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('updateCommunityRating', () => {
    it('should upsert community rating successfully', async () => {
      const mockDb = createMockDb();

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await repository.updateCommunityRating('media-1', 42, 15);

      // Should use INSERT ... ON CONFLICT (upsert pattern)
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [DrizzleStatsRepository, { provide: DATABASE_CONNECTION, useValue: mockDb }],
      }).compile();

      repository = module.get<DrizzleStatsRepository>(DrizzleStatsRepository);

      await expect(repository.updateCommunityRating('media-1', 42, 15)).rejects.toThrow(
        DatabaseException,
      );
    });
  });
});
