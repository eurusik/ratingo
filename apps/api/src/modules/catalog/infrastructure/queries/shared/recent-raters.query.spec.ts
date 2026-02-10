import { Test, TestingModule } from '@nestjs/testing';
import { RecentRatersQuery } from './recent-raters.query';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import { DatabaseException } from '../../../../../common/exceptions/database.exception';
import { createDrizzleThenable } from '../../__test__/drizzle-mock.utils';

describe('RecentRatersQuery', () => {
  let query: RecentRatersQuery;
  let db: any;
  let selectChain: any;

  const setup = (options: { resolveWith?: any[]; rejectWith?: Error } = {}) => {
    selectChain = createDrizzleThenable(options.resolveWith ?? [], options.rejectWith);
    db = {
      select: jest.fn().mockReturnValue(selectChain),
    };

    return Test.createTestingModule({
      providers: [RecentRatersQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
  };

  describe('fetchForMediaItem', () => {
    it('should return mapped raters for a media item', async () => {
      const mockRaters = [
        { userId: 'u1', username: 'alice', avatarUrl: '/avatars/alice.png' },
        { userId: 'u2', username: 'bob', avatarUrl: null },
      ];
      const module: TestingModule = await setup({ resolveWith: mockRaters });
      query = module.get(RecentRatersQuery);

      const result = await query.fetchForMediaItem('media-1');

      expect(result).toEqual(mockRaters);
      expect(db.select).toHaveBeenCalledWith({
        userId: expect.anything(),
        username: expect.anything(),
        avatarUrl: expect.anything(),
      });
      expect(selectChain.from).toHaveBeenCalled();
      expect(selectChain.innerJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(3);
    });

    it('should return empty array when no raters found', async () => {
      const module: TestingModule = await setup({ resolveWith: [] });
      query = module.get(RecentRatersQuery);

      const result = await query.fetchForMediaItem('media-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ rejectWith: new Error('DB Error') });
      query = module.get(RecentRatersQuery);

      await expect(query.fetchForMediaItem('media-1')).rejects.toThrow(DatabaseException);
    });
  });
});
