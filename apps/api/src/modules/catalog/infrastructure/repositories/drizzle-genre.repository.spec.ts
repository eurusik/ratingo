import { DrizzleGenreRepository } from './drizzle-genre.repository';
import { DatabaseException } from '../../../../common/exceptions';

// Helper to create a chainable thenable for Drizzle-like calls
const createThenable = (resolveWith: unknown = [], rejectWith?: Error) => {
  const thenable: Record<string, jest.Mock | ((res: unknown, rej?: unknown) => Promise<unknown>)> =
    {};
  const chainMethods = ['insert', 'values', 'onConflictDoNothing', 'select', 'from', 'where'];
  chainMethods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: unknown, rej: unknown) =>
      Promise.reject(rejectWith).catch(rej as (reason: unknown) => unknown);
  } else {
    thenable.then = (res: unknown) =>
      Promise.resolve(resolveWith).then(res as (value: unknown) => unknown);
  }
  return thenable;
};

describe('DrizzleGenreRepository', () => {
  let repository: DrizzleGenreRepository;

  const createMockTx = (options: { resolveSelect?: unknown; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    const insertChain = createThenable([], options.reject);

    return {
      insert: jest.fn().mockReturnValue(insertChain),
      select: jest.fn().mockReturnValue(selectChain),
      insertChain,
      selectChain,
    };
  };

  beforeEach(() => {
    repository = new DrizzleGenreRepository();
  });

  it('should sync genres and link to media', async () => {
    const mockTx = createMockTx({ resolveSelect: [{ id: 'g1' }] });
    const genres = [{ tmdbId: 1, name: 'Action', slug: 'action' }];

    await repository.syncGenres(mockTx, 'media-1', genres);

    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockTx.select).toHaveBeenCalled();
    expect(mockTx.insertChain.onConflictDoNothing).toHaveBeenCalled();
    expect(mockTx.insert.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should not link when no genre ids found', async () => {
    const mockTx = createMockTx({ resolveSelect: [] });

    await repository.syncGenres(mockTx, 'media-1', [{ tmdbId: 1, name: 'Action', slug: 'action' }]);

    // registry insert happens
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
    // no mediaGenres insert because select returned empty
    expect(mockTx.select).toHaveBeenCalledTimes(1);
  });

  it('should return early when genres empty', async () => {
    const mockTx = createMockTx();

    await repository.syncGenres(mockTx, 'media-1', []);

    expect(mockTx.insert).not.toHaveBeenCalled();
    expect(mockTx.select).not.toHaveBeenCalled();
  });

  it('should throw DatabaseException on error', async () => {
    const mockTx = createMockTx({ reject: new Error('DB Error') });

    await expect(
      repository.syncGenres(mockTx, 'media-1', [{ tmdbId: 1, name: 'Action', slug: 'action' }]),
    ).rejects.toThrow(DatabaseException);
  });
});
