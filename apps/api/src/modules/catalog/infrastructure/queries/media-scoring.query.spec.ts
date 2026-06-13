import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';

import { MediaScoringQuery } from './media-scoring.query';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  ['select', 'from', 'where', 'limit', 'leftJoin'].forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });
  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('MediaScoringQuery', () => {
  let query: MediaScoringQuery;
  let db: any;

  const setup = async (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };

    const module = await Test.createTestingModule({
      providers: [MediaScoringQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(MediaScoringQuery);
  };

  describe('findById', () => {
    it('should return scoring data', async () => {
      await setup({ resolveSelect: [{ id: 'm1', popularity: 1 }] });

      const result = await query.findById('m1');
      expect(result).toEqual({ id: 'm1', popularity: 1 });
    });

    it('should return null if not found', async () => {
      await setup({ resolveSelect: [] });

      const result = await query.findById('m1');
      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      await setup({ reject: new Error('DB Error') });

      await expect(query.findById('m1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findMany', () => {
    it('should return empty for empty input', async () => {
      await setup();

      const result = await query.findMany([]);
      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return list for ids', async () => {
      await setup({ resolveSelect: [{ id: 'm1', tmdbId: 1, popularity: 1 }] });

      const result = await query.findMany(['m1']);
      expect(result).toEqual([{ id: 'm1', tmdbId: 1, popularity: 1 }]);
    });

    it('should throw DatabaseException on error', async () => {
      await setup({ reject: new Error('DB Error') });

      await expect(query.findMany(['m1'])).rejects.toThrow(DatabaseException);
    });
  });
});
