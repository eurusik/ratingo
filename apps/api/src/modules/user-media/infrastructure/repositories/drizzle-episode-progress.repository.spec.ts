import { DrizzleEpisodeProgressRepository } from './drizzle-episode-progress.repository';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('DrizzleEpisodeProgressRepository', () => {
  const makeDbMock = () => {
    // Create a mock that handles different query patterns:
    // - insert().values().onConflictDoNothing()
    // - delete().where()
    // - select().from().innerJoin().where() for getWatchedEpisodeIds
    // - select().from().innerJoin().where().orderBy() for getShowProgress
    const orderByMock = jest.fn().mockResolvedValue([]);

    const whereMock = jest.fn().mockImplementation(() => {
      // Return a thenable that also has orderBy method
      const result: any = Promise.resolve([]);
      result.orderBy = orderByMock;
      return result;
    });

    const chain: any = {
      values: jest.fn().mockReturnThis(),
      onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
      where: whereMock,
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: orderByMock,
      from: jest.fn().mockReturnThis(),
    };

    return {
      insert: jest.fn().mockReturnValue(chain),
      delete: jest.fn().mockReturnValue(chain),
      select: jest.fn().mockReturnValue(chain),
      chain,
      orderByMock,
      whereMock,
    };
  };

  describe('markWatched', () => {
    it('should insert episode progress record', async () => {
      const db = makeDbMock();
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      await repo.markWatched('user-1', 'episode-1');

      expect(db.insert).toHaveBeenCalled();
      expect(db.chain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          episodeId: 'episode-1',
        }),
      );
      expect(db.chain.onConflictDoNothing).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const db = makeDbMock();
      db.chain.onConflictDoNothing.mockRejectedValue(new Error('DB error'));
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      await expect(repo.markWatched('user-1', 'episode-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('markUnwatched', () => {
    it('should delete episode progress record', async () => {
      const db = makeDbMock();
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      await repo.markUnwatched('user-1', 'episode-1');

      expect(db.delete).toHaveBeenCalled();
      expect(db.chain.where).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const db = makeDbMock();
      db.chain.where.mockRejectedValue(new Error('DB error'));
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      await expect(repo.markUnwatched('user-1', 'episode-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('getWatchedEpisodeIds', () => {
    it('should return array of watched episode IDs', async () => {
      const db = makeDbMock();
      db.whereMock.mockImplementation(() => {
        const result: any = Promise.resolve([{ episodeId: 'ep-1' }, { episodeId: 'ep-2' }]);
        result.orderBy = db.orderByMock;
        return result;
      });
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      const result = await repo.getWatchedEpisodeIds('user-1', 'show-1');

      expect(result).toEqual(['ep-1', 'ep-2']);
    });

    it('should return empty array when no episodes watched', async () => {
      const db = makeDbMock();
      // Default mock already returns empty array
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      const result = await repo.getWatchedEpisodeIds('user-1', 'show-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on error', async () => {
      const db = makeDbMock();
      db.whereMock.mockImplementation(() => {
        const result: any = Promise.reject(new Error('DB error'));
        result.orderBy = db.orderByMock;
        return result;
      });
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      await expect(repo.getWatchedEpisodeIds('user-1', 'show-1')).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('getShowProgress', () => {
    it('should aggregate progress by season', async () => {
      const db = makeDbMock();
      db.orderByMock.mockResolvedValue([
        { seasonNumber: 1, episodeId: 'ep-1', isWatched: true },
        { seasonNumber: 1, episodeId: 'ep-2', isWatched: true },
        { seasonNumber: 1, episodeId: 'ep-3', isWatched: false },
        { seasonNumber: 2, episodeId: 'ep-4', isWatched: false },
        { seasonNumber: 2, episodeId: 'ep-5', isWatched: false },
      ]);
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      const result = await repo.getShowProgress('user-1', 'show-1');

      expect(result).toEqual([
        {
          seasonNumber: 1,
          watchedCount: 2,
          totalCount: 3,
          watchedEpisodeIds: ['ep-1', 'ep-2'],
        },
        {
          seasonNumber: 2,
          watchedCount: 0,
          totalCount: 2,
          watchedEpisodeIds: [],
        },
      ]);
    });

    it('should return empty array for show with no seasons', async () => {
      const db = makeDbMock();
      // Default orderByMock returns []
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      const result = await repo.getShowProgress('user-1', 'show-1');

      expect(result).toEqual([]);
    });

    it('should sort seasons by number', async () => {
      const db = makeDbMock();
      // Return seasons out of order
      db.orderByMock.mockResolvedValue([
        { seasonNumber: 3, episodeId: 'ep-3', isWatched: false },
        { seasonNumber: 1, episodeId: 'ep-1', isWatched: true },
        { seasonNumber: 2, episodeId: 'ep-2', isWatched: false },
      ]);
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      const result = await repo.getShowProgress('user-1', 'show-1');

      expect(result.map((s) => s.seasonNumber)).toEqual([1, 2, 3]);
    });

    it('should throw DatabaseException on error', async () => {
      const db = makeDbMock();
      db.orderByMock.mockRejectedValue(new Error('DB error'));
      const repo = new DrizzleEpisodeProgressRepository(db as any);

      await expect(repo.getShowProgress('user-1', 'show-1')).rejects.toThrow(DatabaseException);
    });
  });
});
