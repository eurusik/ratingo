import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleMediaRepository } from './drizzle-media.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { GENRE_REPOSITORY } from '../../domain/repositories/genre.repository.interface';
import { MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';
import { SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';
import { HeroMediaQuery } from '../queries/hero-media.query';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions';
import { NormalizedMedia } from '../../../ingestion/domain/models/normalized-media.model';

// Helper to create a chainable thenable for Drizzle-like fluent API
const createThenable = (resolveWith: any = [], rejectWith?: Error, extraMethods: string[] = []) => {
  const thenable: any = {};
  const chainMethods = [
    'select', 'from', 'where', 'limit', 'innerJoin', 'insert', 'values', 'onConflictDoUpdate', 'update', 'orderBy', 'returning',
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

describe('DrizzleMediaRepository', () => {
  let repository: DrizzleMediaRepository;
  let db: any;
  let genreRepo: any;
  let movieRepo: any;
  let showRepo: any;
  let heroQuery: any;

  const setup = (options: { resolveSelect?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    const insertChain = createThenable([], options.reject, ['onConflictDoNothing']);
    const updateChain = createThenable([], options.reject);

    db = {
      select: jest.fn().mockReturnValue(selectChain),
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
      transaction: jest.fn(async (cb: any) => {
        // tx uses the same chain mocks
        return cb({ select: db.select, insert: db.insert, update: db.update });
      }),
    };

    genreRepo = { syncGenres: jest.fn() };
    movieRepo = { upsertDetails: jest.fn() };
    showRepo = { upsertDetails: jest.fn() };
    heroQuery = { execute: jest.fn().mockResolvedValue(['hero']) };

    return Test.createTestingModule({
      providers: [
        DrizzleMediaRepository,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: GENRE_REPOSITORY, useValue: genreRepo },
        { provide: MOVIE_REPOSITORY, useValue: movieRepo },
        { provide: SHOW_REPOSITORY, useValue: showRepo },
        { provide: HeroMediaQuery, useValue: heroQuery },
      ],
    }).compile();
  };

  const baseMedia: NormalizedMedia = {
    type: MediaType.MOVIE,
    externalIds: { tmdbId: 1, imdbId: 'tt1' },
    title: 'Title',
    originalTitle: 'Title',
    slug: 'title',
    overview: 'overview',
    posterPath: '/p.jpg',
    backdropPath: '/b.jpg',
    rating: 8,
    voteCount: 10,
    popularity: 100,
    releaseDate: new Date(),
    videos: null,
    credits: null,
    watchProviders: null,
    genres: [],
    details: {},
  } as any;

  describe('findByTmdbId', () => {
    it('should return media id/slug when found', async () => {
      const module = await setup({ resolveSelect: [{ id: 'm1', slug: 's1' }] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findByTmdbId(1);
      expect(result).toEqual({ id: 'm1', slug: 's1' });
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findByTmdbId(1);
      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      await expect(repository.findByTmdbId(1)).rejects.toThrow(DatabaseException);
    });
  });

  describe('findByIdForScoring', () => {
    it('should return scoring data', async () => {
      const module = await setup({ resolveSelect: [{ id: 'm1', popularity: 1 }] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findByIdForScoring('m1');
      expect(result).toEqual({ id: 'm1', popularity: 1 });
    });

    it('should return null if not found', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findByIdForScoring('m1');
      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      await expect(repository.findByIdForScoring('m1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findManyByTmdbIds', () => {
    it('should return empty for empty input', async () => {
      const module = await setup();
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findManyByTmdbIds([]);
      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return list for ids', async () => {
      const module = await setup({ resolveSelect: [{ id: 'm1', tmdbId: 1 }] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findManyByTmdbIds([1]);
      expect(result).toEqual([{ id: 'm1', tmdbId: 1 }]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      await expect(repository.findManyByTmdbIds([1])).rejects.toThrow(DatabaseException);
    });
  });

  describe('findManyForScoring', () => {
    it('should return empty for empty input', async () => {
      const module = await setup();
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findManyForScoring([]);
      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return list for ids', async () => {
      const module = await setup({ resolveSelect: [{ id: 'm1', tmdbId: 1, popularity: 1 }] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findManyForScoring(['m1']);
      expect(result).toEqual([{ id: 'm1', tmdbId: 1, popularity: 1 }]);
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      await expect(repository.findManyForScoring(['m1'])).rejects.toThrow(DatabaseException);
    });
  });

  describe('findHero', () => {
    it('should delegate to heroMediaQuery', async () => {
      const module = await setup();
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findHero(5, MediaType.MOVIE);
      expect(result).toEqual(['hero']);
      expect(heroQuery.execute).toHaveBeenCalledWith({ limit: 5, type: MediaType.MOVIE });
    });
  });

  describe('search', () => {
    it('should return results', async () => {
      const module = await setup({ resolveSelect: [{ id: 'm1' }] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.search('test query', 10);
      expect(result).toEqual([{ id: 'm1' }]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.search('bad', 5);
      expect(result).toEqual([]);
    });
  });
});
