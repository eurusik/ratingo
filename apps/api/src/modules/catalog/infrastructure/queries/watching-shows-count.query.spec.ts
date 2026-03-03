import { WatchingShowsCountQuery } from './watching-shows-count.query';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'innerJoin', 'where'];
  methods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  const terminal = rejectWith ? Promise.reject(rejectWith) : Promise.resolve(resolveWith);
  thenable.where = jest.fn().mockReturnValue(terminal);
  return thenable;
};

describe('WatchingShowsCountQuery', () => {
  let db: any;
  let query: WatchingShowsCountQuery;

  const setup = (result: any[], reject?: Error) => {
    db = { select: jest.fn().mockReturnValue(createThenable(result, reject)) };
    query = new WatchingShowsCountQuery(db as any);
  };

  it('should return count from result', async () => {
    setup([{ count: 5 }]);
    expect(await query.execute('user-1')).toBe(5);
  });

  it('should return 0 when result is empty', async () => {
    setup([]);
    expect(await query.execute('user-1')).toBe(0);
  });

  it('should return 0 when count is 0', async () => {
    setup([{ count: 0 }]);
    expect(await query.execute('user-1')).toBe(0);
  });

  it('should perform innerJoin (filters by media type via join)', async () => {
    setup([{ count: 2 }]);
    await query.execute('user-1');
    const thenable = db.select.mock.results[0].value;
    // Expects exactly 1 innerJoin: userMediaState → mediaItems
    expect(thenable.innerJoin).toHaveBeenCalledTimes(1);
  });

  it('should throw DatabaseException on database error', async () => {
    setup([], new Error('DB connection lost'));
    await expect(query.execute('user-1')).rejects.toThrow(DatabaseException);
  });
});
