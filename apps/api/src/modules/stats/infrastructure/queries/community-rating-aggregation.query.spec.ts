import { Test, TestingModule } from '@nestjs/testing';
import { CommunityRatingAggregationQuery } from './community-rating-aggregation.query';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';

describe('CommunityRatingAggregationQuery', () => {
  let query: CommunityRatingAggregationQuery;

  const createMockDb = (options: { resolveWith?: any; rejectWith?: Error } = {}) => {
    // Create a thenable object that resolves/rejects when awaited
    const createThenable = () => {
      const thenable: any = {};

      // All chain methods return the same thenable
      const chainMethods = [
        'from',
        'where',
        'limit',
        'innerJoin',
        'values',
        'onConflictDoUpdate',
        'groupBy',
      ];
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

  describe('aggregateForMediaItem', () => {
    it('should return aggregation when ratings exist', async () => {
      const mockResult = [{ averageRating: 4.2, ratingCount: 15 }];
      const mockDb = createMockDb({ resolveWith: mockResult });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.aggregateForMediaItem('media-1');

      expect(result).toEqual({ averageRating: 4.2, ratingCount: 15 });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when no ratings (empty result)', async () => {
      const mockDb = createMockDb({ resolveWith: [] });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.aggregateForMediaItem('non-existent');

      expect(result).toBeNull();
    });

    it('should return null when ratingCount is 0', async () => {
      const mockResult = [{ averageRating: null, ratingCount: 0 }];
      const mockDb = createMockDb({ resolveWith: mockResult });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.aggregateForMediaItem('media-no-ratings');

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on DB error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      await expect(query.aggregateForMediaItem('media-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('aggregateAll', () => {
    it('should return Map with multiple items', async () => {
      const mockRows = [
        { mediaItemId: 'media-1', averageRating: 4.5, ratingCount: 10 },
        { mediaItemId: 'media-2', averageRating: 3.8, ratingCount: 25 },
        { mediaItemId: 'media-3', averageRating: 2.1, ratingCount: 3 },
      ];
      const mockDb = createMockDb({ resolveWith: mockRows });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.aggregateAll();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.get('media-1')).toEqual({ averageRating: 4.5, ratingCount: 10 });
      expect(result.get('media-2')).toEqual({ averageRating: 3.8, ratingCount: 25 });
      expect(result.get('media-3')).toEqual({ averageRating: 2.1, ratingCount: 3 });
    });

    it('should return empty Map when no ratings', async () => {
      const mockDb = createMockDb({ resolveWith: [] });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.aggregateAll();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should filter out items with ratingCount 0', async () => {
      const mockRows = [
        { mediaItemId: 'media-1', averageRating: 4.5, ratingCount: 10 },
        { mediaItemId: 'media-2', averageRating: null, ratingCount: 0 },
        { mediaItemId: 'media-3', averageRating: 3.0, ratingCount: 5 },
      ];
      const mockDb = createMockDb({ resolveWith: mockRows });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.aggregateAll();

      expect(result.size).toBe(2);
      expect(result.has('media-1')).toBe(true);
      expect(result.has('media-2')).toBe(false);
      expect(result.has('media-3')).toBe(true);
    });

    it('should throw DatabaseException on DB error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      await expect(query.aggregateAll()).rejects.toThrow(DatabaseException);
    });
  });

  describe('findMediaItemIdsWithCommunityRatings', () => {
    it('should return array of IDs', async () => {
      const mockRows = [
        { mediaItemId: 'media-1' },
        { mediaItemId: 'media-2' },
        { mediaItemId: 'media-3' },
      ];
      const mockDb = createMockDb({ resolveWith: mockRows });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.findMediaItemIdsWithCommunityRatings();

      expect(result).toEqual(['media-1', 'media-2', 'media-3']);
    });

    it('should return empty array when none found', async () => {
      const mockDb = createMockDb({ resolveWith: [] });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      const result = await query.findMediaItemIdsWithCommunityRatings();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on DB error', async () => {
      const mockDb = createMockDb({ rejectWith: new Error('DB Error') });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunityRatingAggregationQuery,
          { provide: DATABASE_CONNECTION, useValue: mockDb },
        ],
      }).compile();

      query = module.get<CommunityRatingAggregationQuery>(CommunityRatingAggregationQuery);

      await expect(query.findMediaItemIdsWithCommunityRatings()).rejects.toThrow(DatabaseException);
    });
  });
});
