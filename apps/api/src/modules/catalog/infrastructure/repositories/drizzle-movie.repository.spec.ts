import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleMovieRepository } from './drizzle-movie.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { MovieDetailsQuery } from '../queries/movie-details.query';
import { TrendingMoviesQuery } from '../queries/trending-movies.query';
import { MovieListingsQuery } from '../queries/movie-listings.query';

// Chainable thenable mock for Drizzle-like fluent API
const createThenable = (resolveWith: any = [], rejectWith?: Error, extraMethods: string[] = []) => {
  const thenable: any = {};
  const chainMethods = [
    'insert',
    'values',
    'onConflictDoUpdate',
    'update',
    'set',
    'where',
    'select',
    'from',
    'innerJoin',
    'limit',
    ...extraMethods,
  ];
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

describe('DrizzleMovieRepository', () => {
  let repository: DrizzleMovieRepository;
  let db: any;
  let movieDetailsQuery: any;
  let trendingMoviesQuery: any;
  let movieListingsQuery: any;
  let insertChain: any;
  let selectChain: any;
  let updateChain: any;

  const setup = (options: { resolveSelect?: any; reject?: Error } = {}) => {
    selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    insertChain = createThenable([], options.reject);
    updateChain = createThenable([], options.reject);

    db = {
      select: jest.fn().mockReturnValue(selectChain),
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
      transaction: jest.fn(async (cb: any) =>
        cb({ select: db.select, insert: db.insert, update: db.update })
      ),
    };

    movieDetailsQuery = { execute: jest.fn().mockResolvedValue('details') };
    trendingMoviesQuery = { execute: jest.fn().mockResolvedValue(['trending']) };
    movieListingsQuery = { execute: jest.fn().mockResolvedValue(['listings']) };

    return Test.createTestingModule({
      providers: [
        DrizzleMovieRepository,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: MovieDetailsQuery, useValue: movieDetailsQuery },
        { provide: TrendingMoviesQuery, useValue: trendingMoviesQuery },
        { provide: MovieListingsQuery, useValue: movieListingsQuery },
      ],
    }).compile();
  };

  describe('upsertDetails', () => {
    it('should insert/update movie details via tx', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);
      const tx = { insert: jest.fn().mockReturnValue(insertChain) } as any;

      await repository.upsertDetails(tx, 'media-1', { runtime: 100 });
      expect(tx.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalled();
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should propagate errors', async () => {
      const txChain = createThenable([], new Error('DB Error'));
      const tx = { insert: jest.fn().mockReturnValue(txChain) } as any;
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);

      await expect(repository.upsertDetails(tx, 'media-1', {})).rejects.toThrow('DB Error');
    });
  });

  describe('setNowPlaying', () => {
    it('should return early on empty input', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);
      await repository.setNowPlaying([]);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should update flags when media found', async () => {
      const module: TestingModule = await setup({ resolveSelect: [{ id: 'm1' }] });
      repository = module.get(DrizzleMovieRepository);

      await repository.setNowPlaying([1]);

      // transaction called once
      expect(db.transaction).toHaveBeenCalled();
      // two updates inside transaction
      expect(db.update).toHaveBeenCalledTimes(2);
      expect(db.select).toHaveBeenCalled();
    });

    it('should warn and return when no media items found', async () => {
      const module: TestingModule = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMovieRepository);

      await repository.setNowPlaying([1]);
      // first update to set false, select once, no second update
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('should propagate transaction errors', async () => {
      const error = new Error('TX Error');
      db = {
        select: jest.fn().mockReturnValue(selectChain),
        insert: jest.fn().mockReturnValue(insertChain),
        update: jest.fn().mockReturnValue(updateChain),
        transaction: jest.fn(async () => {
          throw error;
        }),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleMovieRepository,
          { provide: DATABASE_CONNECTION, useValue: db },
          { provide: MovieDetailsQuery, useValue: movieDetailsQuery },
          { provide: TrendingMoviesQuery, useValue: trendingMoviesQuery },
          { provide: MovieListingsQuery, useValue: movieListingsQuery },
        ],
      }).compile();
      repository = module.get(DrizzleMovieRepository);

      await expect(repository.setNowPlaying([1])).rejects.toThrow('TX Error');
    });
  });

  describe('updateReleaseDates', () => {
    it('should update release dates', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);

      await repository.updateReleaseDates('mid', { theatricalReleaseDate: new Date() });
      expect(db.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalled();
      expect(updateChain.where).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMovieRepository);

      await expect(repository.updateReleaseDates('mid', {})).rejects.toThrow(DatabaseException);
    });
  });

  describe('delegating queries', () => {
    it('findBySlug delegates to movieDetailsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);

      const res = await repository.findBySlug('slug');
      expect(res).toEqual('details');
      expect(movieDetailsQuery.execute).toHaveBeenCalledWith('slug');
    });

    it('findTrending delegates to trendingMoviesQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);

      const res = await repository.findTrending({} as any);
      expect(res).toEqual(['trending']);
      expect(trendingMoviesQuery.execute).toHaveBeenCalled();
    });

    it('findNowPlaying delegates to movieListingsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);

      const res = await repository.findNowPlaying({} as any);
      expect(res).toEqual(['listings']);
      expect(movieListingsQuery.execute).toHaveBeenCalledWith('now_playing', {});
    });

    it('findNewReleases delegates to movieListingsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);

      await repository.findNewReleases({} as any);
      expect(movieListingsQuery.execute).toHaveBeenCalledWith('new_releases', {});
    });

    it('findNewOnDigital delegates to movieListingsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleMovieRepository);

      await repository.findNewOnDigital({} as any);
      expect(movieListingsQuery.execute).toHaveBeenCalledWith('new_on_digital', {});
    });
  });
});
