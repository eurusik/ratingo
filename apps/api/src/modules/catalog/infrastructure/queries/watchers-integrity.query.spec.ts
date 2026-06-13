import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';
import { MediaType } from '../../../../common/enums/media-type.enum';

import { WatchersIntegrityQuery } from './watchers-integrity.query';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin', 'leftJoin'].forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });
  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('WatchersIntegrityQuery', () => {
  let query: WatchersIntegrityQuery;
  let db: any;

  const setup = async (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };

    const module = await Test.createTestingModule({
      providers: [WatchersIntegrityQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(WatchersIntegrityQuery);
  };

  describe('findMissingWatchers', () => {
    it('should map and filter rows with null tmdbId or voteCountTrakt', async () => {
      await setup({
        resolveSelect: [
          { id: 'm1', tmdbId: 1, type: MediaType.MOVIE, voteCountTrakt: 50 },
          { id: 'm2', tmdbId: null, type: MediaType.MOVIE, voteCountTrakt: 50 },
          { id: 'm3', tmdbId: 3, type: MediaType.MOVIE, voteCountTrakt: null },
        ],
      });

      const result = await query.findMissingWatchers({ limit: 5, minVotes: 10 });
      expect(result).toEqual([{ id: 'm1', tmdbId: 1, type: MediaType.MOVIE, voteCountTrakt: 50 }]);
    });

    it('should throw DatabaseException on error', async () => {
      await setup({ reject: new Error('DB Error') });

      await expect(query.findMissingWatchers({ limit: 5, minVotes: 10 })).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('findCorruptedWatchersCount', () => {
    it('should map rows and default voteCountTrakt to 0 when null', async () => {
      await setup({
        resolveSelect: [
          { id: 'm1', tmdbId: 1, type: MediaType.MOVIE, voteCountTrakt: null },
          { id: 'm2', tmdbId: null, type: MediaType.SHOW, voteCountTrakt: 5 },
        ],
      });

      const result = await query.findCorruptedWatchersCount({ limit: 5, minTotalWatchers: 100 });
      expect(result).toEqual([{ id: 'm1', tmdbId: 1, type: MediaType.MOVIE, voteCountTrakt: 0 }]);
    });

    it('should throw DatabaseException on error', async () => {
      await setup({ reject: new Error('DB Error') });

      await expect(
        query.findCorruptedWatchersCount({ limit: 5, minTotalWatchers: 100 }),
      ).rejects.toThrow(DatabaseException);
    });
  });
});
