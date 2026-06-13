import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';
import { MediaType } from '../../../../common/enums/media-type.enum';

import { EligibleTrendingQuery } from './eligible-trending.query';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'innerJoin', 'leftJoin'].forEach(
    (m) => {
      thenable[m] = jest.fn().mockReturnValue(thenable);
    },
  );
  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('EligibleTrendingQuery', () => {
  let query: EligibleTrendingQuery;
  let db: any;

  const setup = async (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };

    const module = await Test.createTestingModule({
      providers: [EligibleTrendingQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(EligibleTrendingQuery);
  };

  it('should return eligible items with tmdbId and type', async () => {
    const mockRows = [
      { id: 'm1', tmdbId: 100, type: MediaType.MOVIE },
      { id: 's1', tmdbId: 200, type: MediaType.SHOW },
    ];
    await setup({ resolveSelect: mockRows });

    const result = await query.execute({ limit: 10, offset: 0 });

    expect(result).toEqual([
      { id: 'm1', tmdbId: 100, type: MediaType.MOVIE },
      { id: 's1', tmdbId: 200, type: MediaType.SHOW },
    ]);
    expect(db.select).toHaveBeenCalled();
  });

  it('should return empty array when no items found', async () => {
    await setup({ resolveSelect: [] });

    const result = await query.execute({ limit: 10, offset: 0 });

    expect(result).toEqual([]);
  });

  it('should respect limit and offset', async () => {
    await setup({ resolveSelect: [{ id: 'm1', tmdbId: 100, type: MediaType.MOVIE }] });

    await query.execute({ limit: 50, offset: 100 });

    const selectChain = db.select.mock.results[0].value;
    expect(selectChain.limit).toHaveBeenCalledWith(50);
    expect(selectChain.offset).toHaveBeenCalledWith(100);
  });

  it('should throw DatabaseException on error', async () => {
    await setup({ reject: new Error('DB Error') });

    await expect(query.execute({ limit: 10, offset: 0 })).rejects.toThrow(DatabaseException);
  });
});
