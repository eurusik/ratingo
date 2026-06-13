import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';
import { MediaType } from '../../../../common/enums/media-type.enum';

import { TrendingUpdatedItemsQuery } from './trending-updated-items.query';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  ['select', 'from', 'where', 'limit', 'orderBy'].forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });
  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('TrendingUpdatedItemsQuery', () => {
  let query: TrendingUpdatedItemsQuery;
  let db: any;

  const setup = async (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };

    const module = await Test.createTestingModule({
      providers: [TrendingUpdatedItemsQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(TrendingUpdatedItemsQuery);
  };

  it('should return items filtered to valid tmdbIds', async () => {
    await setup({
      resolveSelect: [
        { id: 'm1', tmdbId: 1, type: MediaType.MOVIE },
        { id: 'm2', tmdbId: null, type: MediaType.MOVIE },
      ],
    });

    const result = await query.execute({ limit: 5 });
    expect(result).toEqual([{ id: 'm1', tmdbId: 1, type: MediaType.MOVIE }]);
  });

  it('should apply since filter when provided', async () => {
    await setup({ resolveSelect: [] });

    const result = await query.execute({ since: new Date('2024-01-01'), limit: 5 });
    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalled();
  });

  it('should throw DatabaseException on error', async () => {
    await setup({ reject: new Error('DB Error') });

    await expect(query.execute({ limit: 5 })).rejects.toThrow(DatabaseException);
  });
});
