import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';
import { MediaType } from '../../../../common/enums/media-type.enum';

import { SnapshotCandidatesQuery } from './snapshot-candidates.query';

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

describe('SnapshotCandidatesQuery', () => {
  let query: SnapshotCandidatesQuery;
  let db: any;

  // First db.select() resolves the active policy, second resolves the candidate rows.
  const setupSequential = async (policyRows: any, candidateRows: any) => {
    const policyChain = createThenable(policyRows);
    const candidateChain = createThenable(candidateRows);
    let call = 0;
    db = {
      select: jest.fn().mockImplementation(() => {
        call += 1;
        return call === 1 ? policyChain : candidateChain;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [SnapshotCandidatesQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(SnapshotCandidatesQuery);
  };

  it('should return empty array when no active policy', async () => {
    await setupSequential([], []);

    const result = await query.execute({ limit: 5 });
    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should return mapped candidates for active policy', async () => {
    await setupSequential(
      [{ version: 3 }],
      [
        { id: 'm1', tmdbId: 1, type: MediaType.MOVIE },
        { id: 'm2', tmdbId: null, type: MediaType.MOVIE },
      ],
    );

    const result = await query.execute({ limit: 5 });
    expect(result).toEqual([{ id: 'm1', tmdbId: 1, type: MediaType.MOVIE }]);
  });

  it('should throw DatabaseException on error', async () => {
    const policyChain = createThenable([], new Error('DB Error'));
    db = { select: jest.fn().mockReturnValue(policyChain) };
    const module = await Test.createTestingModule({
      providers: [SnapshotCandidatesQuery, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    query = module.get(SnapshotCandidatesQuery);

    await expect(query.execute({ limit: 5 })).rejects.toThrow(DatabaseException);
  });
});
