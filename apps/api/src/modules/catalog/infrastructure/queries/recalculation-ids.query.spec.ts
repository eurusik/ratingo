import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';
import { MediaType } from '../../../../common/enums/media-type.enum';

import { RecalculationIdsQuery } from './recalculation-ids.query';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  ['select', 'from', 'where', 'limit', 'offset', 'orderBy'].forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });
  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('RecalculationIdsQuery', () => {
  let query: RecalculationIdsQuery;
  let db: any;

  const setup = async (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };

    const module = await Test.createTestingModule({
      providers: [RecalculationIdsQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(RecalculationIdsQuery);
  };

  it('should return mapped ids', async () => {
    await setup({ resolveSelect: [{ id: 'x' }] });

    const result = await query.execute({ limit: 1, offset: 0 });
    expect(result).toEqual(['x']);
  });

  it('should apply type filter when provided', async () => {
    await setup({ resolveSelect: [{ id: 'y' }] });

    const result = await query.execute({ type: MediaType.SHOW, limit: 1, offset: 0 });
    expect(result).toEqual(['y']);
    expect(db.select).toHaveBeenCalled();
  });

  it('should throw DatabaseException on error', async () => {
    await setup({ reject: new Error('DB Error') });

    await expect(query.execute({ limit: 1, offset: 0 })).rejects.toThrow(DatabaseException);
  });
});
