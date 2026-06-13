import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';

import { MediaSearchQuery } from './media-search.query';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin'].forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });
  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('MediaSearchQuery', () => {
  let query: MediaSearchQuery;
  let db: any;

  const setup = async (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };

    const module = await Test.createTestingModule({
      providers: [MediaSearchQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(MediaSearchQuery);
  };

  it('should return results matching the query', async () => {
    await setup({ resolveSelect: [{ id: 'm1' }] });

    const result = await query.execute('test query', 10);
    expect(result).toEqual([{ id: 'm1' }]);
    expect(db.select).toHaveBeenCalled();
  });

  it('should call db.select twice: once for outer query and once for EXISTS subquery', async () => {
    // The EXISTS subquery is built via this.db.select({ one: sql`1` }) nested inside
    // the outer query's where clause. This means db.select is called twice per search call.
    await setup({ resolveSelect: [{ id: 'm1' }] });

    await query.execute('test', 10);

    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('should not call innerJoin (EXISTS subquery replaces JOIN to avoid row multiplication)', async () => {
    await setup({ resolveSelect: [{ id: 'm1' }] });

    await query.execute('test', 10);

    const selectChain = db.select.mock.results[0].value;
    expect(selectChain.innerJoin).not.toHaveBeenCalled();
  });

  it('should return empty array and not throw when a DB error occurs', async () => {
    await setup({ reject: new Error('DB Error') });

    const result = await query.execute('bad', 5);
    expect(result).toEqual([]);
  });

  it('should return empty array for a query that matches nothing', async () => {
    await setup({ resolveSelect: [] });

    const result = await query.execute('zzznomatch', 10);
    expect(result).toEqual([]);
  });

  it('should respect the limit parameter', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}` }));
    await setup({ resolveSelect: rows });

    const result = await query.execute('popular', 5);
    expect(result).toHaveLength(5);

    const selectChain = db.select.mock.results[0].value;
    expect(selectChain.limit).toHaveBeenCalledWith(5);
  });
});
