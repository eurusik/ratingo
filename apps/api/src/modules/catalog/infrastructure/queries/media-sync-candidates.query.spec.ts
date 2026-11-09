import { MediaSyncCandidatesQuery } from './media-sync-candidates.query';
import { createDrizzleThenable } from '../__test__/drizzle-mock.utils';
import { MediaType } from '@/common/enums/media-type.enum';
import { DatabaseException } from '@/common/exceptions';

describe('MediaSyncCandidatesQuery', () => {
  let db: any;

  const createQuery = (options: { resolveSelect?: unknown; reject?: Error } = {}) => {
    const selectChain = createDrizzleThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };
    return new MediaSyncCandidatesQuery(db);
  };

  describe('findEligibleForTrending', () => {
    it('should return eligible items with tmdbId and type', async () => {
      const mockRows = [
        { id: 'm1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 's1', tmdbId: 200, type: MediaType.SHOW },
      ];
      const query = createQuery({ resolveSelect: mockRows });

      const result = await query.findEligibleForTrending({ limit: 10 });

      expect(result).toEqual([
        { id: 'm1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 's1', tmdbId: 200, type: MediaType.SHOW },
      ]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return empty array when no items found', async () => {
      const query = createQuery({ resolveSelect: [] });

      const result = await query.findEligibleForTrending({ limit: 10 });

      expect(result).toEqual([]);
    });

    it('should accept a keyset cursor instead of an offset', async () => {
      const query = createQuery({
        resolveSelect: [{ id: 'm1', tmdbId: 100, type: MediaType.MOVIE }],
      });

      await query.findEligibleForTrending({ limit: 50, afterId: 'm0' });

      expect(db.select).toHaveBeenCalled();
      const chain = db.select.mock.results[0].value;
      expect(chain.limit).toHaveBeenCalledWith(50);
      expect(chain.offset).not.toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const query = createQuery({ reject: new Error('DB Error') });

      await expect(query.findEligibleForTrending({ limit: 10 })).rejects.toThrow(DatabaseException);
    });
  });

  describe('findSnapshotCandidates', () => {
    it('should return empty list without querying media when no policy is active', async () => {
      const query = createQuery({ resolveSelect: [] });

      const result = await query.findSnapshotCandidates({ limit: 10 });

      expect(result).toEqual([]);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('should return candidates for the active policy', async () => {
      const query = createQuery();
      const rows = [{ id: 'm1', tmdbId: 100, type: MediaType.MOVIE }];
      db.select
        .mockReturnValueOnce(createDrizzleThenable([{ version: 3 }]))
        .mockReturnValueOnce(createDrizzleThenable(rows));

      const result = await query.findSnapshotCandidates({ limit: 10, cursor: 'm0' });

      expect(result).toEqual(rows);
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('findItemsWithMissingWatchers', () => {
    it('should drop rows without Trakt votes', async () => {
      const query = createQuery({
        resolveSelect: [
          { id: 'm1', tmdbId: 1, type: MediaType.MOVIE, voteCountTrakt: 50 },
          { id: 'm2', tmdbId: 2, type: MediaType.MOVIE, voteCountTrakt: null },
        ],
      });

      const result = await query.findItemsWithMissingWatchers({ limit: 10, minVotes: 10 });

      expect(result).toEqual([{ id: 'm1', tmdbId: 1, type: MediaType.MOVIE, voteCountTrakt: 50 }]);
    });
  });

  describe('findItemsWithCorruptedWatchersCount', () => {
    it('should default missing Trakt votes to zero', async () => {
      const query = createQuery({
        resolveSelect: [{ id: 's1', tmdbId: 2, type: MediaType.SHOW, voteCountTrakt: null }],
      });

      const result = await query.findItemsWithCorruptedWatchersCount({
        limit: 10,
        minTotalWatchers: 100,
      });

      expect(result).toEqual([{ id: 's1', tmdbId: 2, type: MediaType.SHOW, voteCountTrakt: 0 }]);
    });
  });

  describe('findHeroCandidatesForStatsRefresh', () => {
    it('should throw DatabaseException on error', async () => {
      const query = createQuery({ reject: new Error('DB Error') });

      await expect(
        query.findHeroCandidatesForStatsRefresh({ staleThresholdHours: 6, limit: 10 }),
      ).rejects.toThrow(DatabaseException);
    });
  });
});
