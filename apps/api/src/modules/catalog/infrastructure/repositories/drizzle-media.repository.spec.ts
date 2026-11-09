import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DrizzleMediaRepository } from './drizzle-media.repository';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { GENRE_REPOSITORY } from '@/modules/catalog/domain/repositories/genre.repository.interface';
import { MOVIE_REPOSITORY } from '@/modules/catalog/domain/repositories/movie.repository.interface';
import { SHOW_REPOSITORY } from '@/modules/catalog/domain/repositories/show.repository.interface';
import { HeroMediaQuery } from '../queries/hero-media.query';
import { MediaSearchQuery } from '../queries/media-search.query';
import { MediaStubUpsertQuery } from '../queries/media-stub-upsert.query';
import { MediaSyncCandidatesQuery } from '../queries/media-sync-candidates.query';
import { MediaUpsertQuery } from '../queries/media-upsert.query';
import { MediaType } from '@/common/enums/media-type.enum';
import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { DatabaseException } from '@/common/exceptions';
import { NormalizedMedia } from '@/modules/shared/contracts';

// Helper to create a chainable thenable for Drizzle-like fluent API
const createThenable = (resolveWith: any = [], rejectWith?: Error, extraMethods: string[] = []) => {
  const thenable: any = {};
  const chainMethods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'innerJoin',
    'leftJoin',
    'insert',
    'values',
    'onConflictDoUpdate',
    'update',
    'orderBy',
    'returning',
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
    const updateChain = createThenable([], options.reject, ['set']);

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
        MediaStubUpsertQuery,
        MediaUpsertQuery,
        MediaSearchQuery,
        MediaSyncCandidatesQuery,
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
      const module = await setup({
        resolveSelect: [{ id: 'm1', tmdbId: 1, type: MediaType.MOVIE, alternativeTitles: null }],
      });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findManyByTmdbIds([1]);
      expect(result).toEqual([
        { id: 'm1', tmdbId: 1, type: MediaType.MOVIE, alternativeTitles: null },
      ]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter by type when provided (movie/show tmdb id spaces overlap)', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMediaRepository);

      await repository.findManyByTmdbIds([1, 2], MediaType.MOVIE);

      const selectChain = db.select.mock.results[0].value;
      const { sql: whereSql, params } = new PgDialect().sqlToQuery(
        selectChain.where.mock.calls[0][0],
      );
      expect(whereSql).toContain('"type"');
      expect(params).toContain(MediaType.MOVIE);
    });

    it('should not filter by type when omitted', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMediaRepository);

      await repository.findManyByTmdbIds([1, 2]);

      const selectChain = db.select.mock.results[0].value;
      const { sql: whereSql } = new PgDialect().sqlToQuery(selectChain.where.mock.calls[0][0]);
      expect(whereSql).not.toContain('"type"');
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      await expect(repository.findManyByTmdbIds([1])).rejects.toThrow(DatabaseException);
    });
  });

  describe('updateIngestionStatus', () => {
    it('should scope the update by tmdb id AND type', async () => {
      const module = await setup();
      repository = module.get(DrizzleMediaRepository);

      await repository.updateIngestionStatus(5, MediaType.SHOW, IngestionStatus.IMPORTING);

      const updateChain = db.update.mock.results[0].value;
      const { sql: whereSql, params } = new PgDialect().sqlToQuery(
        updateChain.where.mock.calls[0][0],
      );
      expect(whereSql).toContain('"tmdb_id"');
      expect(whereSql).toContain('"type"');
      expect(whereSql).not.toContain('"ingestion_status"');
      expect(params).toEqual(expect.arrayContaining([5, MediaType.SHOW]));
    });

    it('should only touch non-READY rows with preserveReady', async () => {
      const module = await setup();
      repository = module.get(DrizzleMediaRepository);

      await repository.updateIngestionStatus(5, MediaType.MOVIE, IngestionStatus.FAILED, {
        preserveReady: true,
      });

      const updateChain = db.update.mock.results[0].value;
      const { sql: whereSql, params } = new PgDialect().sqlToQuery(
        updateChain.where.mock.calls[0][0],
      );
      expect(whereSql).toContain('"ingestion_status" <>');
      expect(params).toContain(IngestionStatus.READY);
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      await expect(
        repository.updateIngestionStatus(5, MediaType.MOVIE, IngestionStatus.FAILED),
      ).rejects.toThrow(DatabaseException);
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
      const module = await setup({
        resolveSelect: [{ id: 'm1', tmdbId: 1, type: MediaType.SHOW, popularity: 1 }],
      });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findManyForScoring(['m1']);
      expect(result).toEqual([{ id: 'm1', tmdbId: 1, type: MediaType.SHOW, popularity: 1 }]);
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
    it('should return results matching the query', async () => {
      const module = await setup({ resolveSelect: [{ id: 'm1' }] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.search('test query', 10);
      expect(result).toEqual([{ id: 'm1' }]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should call db.select twice: once for outer query and once for EXISTS subquery', async () => {
      // The EXISTS subquery is built via this.db.select({ one: sql`1` }) nested inside
      // the outer query's where clause. This means db.select is called twice per search call.
      // Previously the method used innerJoin, which would only call db.select once.
      const module = await setup({ resolveSelect: [{ id: 'm1' }] });
      repository = module.get(DrizzleMediaRepository);

      await repository.search('test', 10);

      // db.select called twice: outer query + EXISTS subquery construction
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('should escape LIKE wildcards and backslashes in the ILIKE pattern', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMediaRepository);

      await repository.search('100%_a\\b', 10);

      // select chain is shared with the EXISTS subquery, whose where() is called first
      const selectChain = db.select.mock.results[0].value;
      const whereCalls = selectChain.where.mock.calls;
      const { params } = new PgDialect().sqlToQuery(whereCalls[whereCalls.length - 1][0]);
      // ILIKE pattern is escaped; the raw term (used by trigram %) stays unescaped
      expect(params).toContain('%100\\%\\_a\\\\b%');
      expect(params).toContain('100%_a\\b');
    });

    it('should not call innerJoin (EXISTS subquery replaces JOIN to avoid row multiplication)', async () => {
      const module = await setup({ resolveSelect: [{ id: 'm1' }] });
      repository = module.get(DrizzleMediaRepository);

      await repository.search('test', 10);

      // The Drizzle chain mock tracks all method calls on the thenable.
      // innerJoin must not be called — it was removed in favour of EXISTS.
      const selectChain = db.select.mock.results[0].value;
      expect(selectChain.innerJoin).not.toHaveBeenCalled();
    });

    it('should return empty array and not throw when a DB error occurs', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.search('bad', 5);
      expect(result).toEqual([]);
    });

    it('should return empty array for a query that matches nothing', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.search('zzznomatch', 10);
      expect(result).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}` }));
      const module = await setup({ resolveSelect: rows });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.search('popular', 5);
      // The repository delegates limit enforcement to the DB; we assert the
      // resolved rows are returned as-is without further slicing.
      expect(result).toHaveLength(5);

      // Verify .limit() was called with the correct parameter
      const selectChain = db.select.mock.results[0].value;
      expect(selectChain.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('write delegation', () => {
    it('should delegate upsertStub to MediaStubUpsertQuery', async () => {
      const module = await setup();
      repository = module.get(DrizzleMediaRepository);
      const execute = jest
        .spyOn(module.get(MediaStubUpsertQuery), 'execute')
        .mockResolvedValue({ id: 'm1', slug: 'title' });
      const payload = {
        tmdbId: 1,
        type: MediaType.MOVIE,
        title: 'Title',
        slug: 'title',
        ingestionStatus: IngestionStatus.IMPORTING,
      };

      await expect(repository.upsertStub(payload)).resolves.toEqual({ id: 'm1', slug: 'title' });
      expect(execute).toHaveBeenCalledWith(payload);
    });

    it('should delegate upsert to MediaUpsertQuery', async () => {
      const module = await setup();
      repository = module.get(DrizzleMediaRepository);
      const execute = jest.spyOn(module.get(MediaUpsertQuery), 'execute').mockResolvedValue();

      await repository.upsert(baseMedia);

      expect(execute).toHaveBeenCalledWith(baseMedia);
    });
  });

  describe('findEligibleForTrending', () => {
    it('should return eligible items with tmdbId and type', async () => {
      const mockRows = [
        { id: 'm1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 's1', tmdbId: 200, type: MediaType.SHOW },
      ];
      const module = await setup({ resolveSelect: mockRows });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findEligibleForTrending({ limit: 10 });

      expect(result).toEqual([
        { id: 'm1', tmdbId: 100, type: MediaType.MOVIE },
        { id: 's1', tmdbId: 200, type: MediaType.SHOW },
      ]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return empty array when no items found', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleMediaRepository);

      const result = await repository.findEligibleForTrending({ limit: 10 });

      expect(result).toEqual([]);
    });

    it('should accept a keyset cursor instead of an offset', async () => {
      const module = await setup({
        resolveSelect: [{ id: 'm1', tmdbId: 100, type: MediaType.MOVIE }],
      });
      repository = module.get(DrizzleMediaRepository);

      await repository.findEligibleForTrending({ limit: 50, afterId: 'm0' });

      expect(db.select).toHaveBeenCalled();
      const chain = db.select.mock.results[0].value;
      expect(chain.limit).toHaveBeenCalledWith(50);
      expect(chain.offset).not.toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleMediaRepository);

      await expect(repository.findEligibleForTrending({ limit: 10 })).rejects.toThrow(
        DatabaseException,
      );
    });
  });
});
