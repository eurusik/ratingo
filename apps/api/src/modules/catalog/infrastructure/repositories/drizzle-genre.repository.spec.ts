import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleGenreRepository } from './drizzle-genre.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions';

// Helper to create a chainable thenable for Drizzle-like calls
const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const chainMethods = ['insert', 'values', 'onConflictDoNothing', 'select', 'from', 'where'];
  chainMethods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('DrizzleGenreRepository', () => {
  let repository: DrizzleGenreRepository;
  let db: any;
  let insertChain: any;
  let selectChain: any;

  const setup = (options: { resolveSelect?: any; reject?: Error } = {}) => {
    selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    insertChain = createThenable([], options.reject);

    db = {
      insert: jest.fn().mockReturnValue(insertChain),
      select: jest.fn().mockReturnValue(selectChain),
    };

    return Test.createTestingModule({
      providers: [DrizzleGenreRepository, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
  };

  it('should sync genres and link to media', async () => {
    const module: TestingModule = await setup({ resolveSelect: [{ id: 'g1' }] });
    repository = module.get(DrizzleGenreRepository);

    const tx = db;
    const genres = [{ tmdbId: 1, name: 'Action', slug: 'action' }];

    await repository.syncGenres(tx, 'media-1', genres);

    expect(db.insert).toHaveBeenCalled();
    expect(db.select).toHaveBeenCalled();
    expect(insertChain.onConflictDoNothing).toHaveBeenCalled();
    expect(db.insert.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should not link when no genre ids found', async () => {
    const module: TestingModule = await setup({ resolveSelect: [] });
    repository = module.get(DrizzleGenreRepository);

    const tx = db;
    await repository.syncGenres(tx, 'media-1', [{ tmdbId: 1, name: 'Action', slug: 'action' }]);

    // registry insert happens
    expect(db.insert).toHaveBeenCalledTimes(1);
    // no mediaGenres insert because select returned empty
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should return early when genres empty', async () => {
    const module: TestingModule = await setup();
    repository = module.get(DrizzleGenreRepository);

    const tx = db;
    await repository.syncGenres(tx, 'media-1', []);

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('should throw DatabaseException on error', async () => {
    const module: TestingModule = await setup({ reject: new Error('DB Error') });
    repository = module.get(DrizzleGenreRepository);

    const tx = db;
    await expect(
      repository.syncGenres(tx, 'media-1', [{ tmdbId: 1, name: 'Action', slug: 'action' }])
    ).rejects.toThrow(DatabaseException);
  });
});
