import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';

import { SnapshotIdsQuery } from './snapshot-ids.query';

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

describe('SnapshotIdsQuery', () => {
  let query: SnapshotIdsQuery;
  let db: any;

  const setup = async (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };

    const module = await Test.createTestingModule({
      providers: [SnapshotIdsQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(SnapshotIdsQuery);
  };

  it('should return mapped ids', async () => {
    await setup({ resolveSelect: [{ id: 'a' }, { id: 'b' }] });

    const result = await query.execute({ limit: 2 });
    expect(result).toEqual(['a', 'b']);
  });

  it('should apply cursor when provided', async () => {
    await setup({ resolveSelect: [{ id: 'c' }] });

    const result = await query.execute({ cursor: 'b', limit: 2 });
    expect(result).toEqual(['c']);
    expect(db.select).toHaveBeenCalled();
  });

  it('should throw DatabaseException on error', async () => {
    await setup({ reject: new Error('DB Error') });

    await expect(query.execute({ limit: 2 })).rejects.toThrow(DatabaseException);
  });
});
