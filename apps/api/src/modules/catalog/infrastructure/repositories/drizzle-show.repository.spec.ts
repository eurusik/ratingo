import { Test, TestingModule } from '@nestjs/testing';
import { PgDialect, QueryBuilder } from 'drizzle-orm/pg-core';
import { DrizzleShowRepository } from './drizzle-show.repository';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { DatabaseException } from '@/common/exceptions/database.exception';
import { PopularShowsQuery } from '../queries/popular-shows.query';
import { TrendingShowsQuery } from '../queries/trending-shows.query';
import { ShowDetailsQuery } from '../queries/show-details.query';
import { CalendarEpisodesQuery } from '../queries/calendar-episodes.query';
import { NewEpisodesQuery } from '../queries/new-episodes.query';

// Chainable thenable mock
const createThenable = (resolveWith: any = [], rejectWith?: Error, extraMethods: string[] = []) => {
  const thenable: any = {};
  const chainMethods = [
    'insert',
    'values',
    'onConflictDoUpdate',
    'returning',
    'update',
    'set',
    'where',
    'select',
    'from',
    'innerJoin',
    'limit',
    'orderBy',
    'delete',
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

describe('DrizzleShowRepository', () => {
  let repository: DrizzleShowRepository;
  let db: any;
  let trendingQuery: any;
  let popularQuery: any;
  let detailsQuery: any;
  let calendarQuery: any;
  let newEpisodesQuery: any;
  let insertChain: any;
  let updateChain: any;
  let selectChain: any;

  const setup = (options: { resolveSelect?: any; reject?: Error } = {}) => {
    insertChain = createThenable([{ id: 'show-id' }], options.reject);
    updateChain = createThenable([], options.reject);
    selectChain = createThenable(options.resolveSelect ?? [], options.reject);

    db = {
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
      select: jest.fn().mockReturnValue(selectChain),
    };

    trendingQuery = { execute: jest.fn().mockResolvedValue(['trending']) };
    popularQuery = { execute: jest.fn().mockResolvedValue(['popular']) };
    detailsQuery = { execute: jest.fn().mockResolvedValue('details') };
    calendarQuery = { execute: jest.fn().mockResolvedValue(['calendar']) };
    newEpisodesQuery = { execute: jest.fn().mockResolvedValue([]) };

    return Test.createTestingModule({
      providers: [
        DrizzleShowRepository,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: TrendingShowsQuery, useValue: trendingQuery },
        { provide: PopularShowsQuery, useValue: popularQuery },
        { provide: ShowDetailsQuery, useValue: detailsQuery },
        { provide: CalendarEpisodesQuery, useValue: calendarQuery },
        { provide: NewEpisodesQuery, useValue: newEpisodesQuery },
      ],
    }).compile();
  };

  const dialect = new PgDialect();
  let deleteChain: any;

  const createPruneTx = () => {
    deleteChain = createThenable([]);
    const qb = new QueryBuilder();
    return {
      insert: jest.fn().mockReturnValue(insertChain),
      delete: jest.fn().mockReturnValue(deleteChain),
      select: jest.fn((fields: any) => qb.select(fields)),
    } as any;
  };

  const renderedDeletes = (tx: any) =>
    tx.delete.mock.calls.map(([table]: any[], i: number) => ({
      table: table[Symbol.for('drizzle:Name')],
      where: dialect.sqlToQuery(deleteChain.where.mock.calls[i][0]),
    }));

  describe('upsertDetails', () => {
    it('should upsert show details, seasons, episodes', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);
      const tx = createPruneTx();

      await repository.upsertDetails(tx, 'media-1', {
        seasons: [{ number: 1, episodes: [{ number: 1, title: 'Pilot' }] }],
      });

      expect(tx.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalled();
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should not overwrite existing episode columns with null (COALESCE on conflict)', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);
      const tx = createPruneTx();

      await repository.upsertDetails(tx, 'media-1', {
        seasons: [{ number: 1, episodes: [{ number: 1, title: 'Pilot' }] }],
      });

      // Last onConflictDoUpdate call is the episodes upsert (seasons come first)
      const calls = insertChain.onConflictDoUpdate.mock.calls;
      const { set } = calls[calls.length - 1][0];
      const dialect = new PgDialect();
      const rendered = Object.fromEntries(
        Object.entries(set).map(([k, v]) => [k, dialect.sqlToQuery(v as any).sql]),
      );

      expect(Object.keys(rendered).sort()).toEqual(
        ['airDate', 'overview', 'runtime', 'stillPath', 'title', 'tmdbId', 'voteAverage'].sort(),
      );
      expect(rendered.tmdbId).toBe('COALESCE(excluded.tmdb_id, "episodes"."tmdb_id")');
      expect(rendered.stillPath).toBe('COALESCE(excluded.still_path, "episodes"."still_path")');
      for (const sqlText of Object.values(rendered)) {
        expect(sqlText).toMatch(/^COALESCE\(excluded\./);
      }
    });

    describe('pruning stale rows', () => {
      it('should delete episodes missing from the source season but keep watched ones', async () => {
        const module: TestingModule = await setup();
        repository = module.get(DrizzleShowRepository);
        const tx = createPruneTx();

        await repository.upsertDetails(tx, 'media-1', {
          seasons: [
            {
              number: 1,
              episodes: [
                { number: 1, title: 'E1' },
                { number: 2, title: 'E2' },
              ],
            },
          ],
        });

        const [episodePrune] = renderedDeletes(tx);
        expect(episodePrune.table).toBe('episodes');
        expect(episodePrune.where.sql).toContain('"episodes"."season_id" = $1');
        expect(episodePrune.where.sql).toContain('"episodes"."number" not in ($2, $3)');
        expect(episodePrune.where.sql).toContain(
          'not exists (select "episode_id" from "user_episode_progress" where "user_episode_progress"."episode_id" = "episodes"."id")',
        );
        expect(episodePrune.where.params).toEqual(['show-id', 1, 2]);
      });

      it('should not prune episodes of a season that came without episodes', async () => {
        const module: TestingModule = await setup();
        repository = module.get(DrizzleShowRepository);
        const tx = createPruneTx();

        await repository.upsertDetails(tx, 'media-1', {
          seasons: [{ number: 1, episodes: [] }],
        });

        const tables = renderedDeletes(tx).map((d: any) => d.table);
        expect(tables).toEqual(['episodes', 'seasons']);
        expect(renderedDeletes(tx)[0].where.sql).toContain('"seasons"."number" not in ($2)');
      });

      it('should delete seasons missing from the source once they hold no episodes', async () => {
        const module: TestingModule = await setup();
        repository = module.get(DrizzleShowRepository);
        const tx = createPruneTx();

        await repository.upsertDetails(tx, 'media-1', {
          seasons: [
            { number: 1, episodes: [{ number: 1, title: 'E1' }] },
            { number: 2, episodes: [{ number: 1, title: 'E1' }] },
          ],
        });

        const deletes = renderedDeletes(tx);
        expect(deletes.map((d: any) => d.table)).toEqual([
          'episodes',
          'episodes',
          'episodes',
          'seasons',
        ]);

        const staleEpisodes = deletes[2].where;
        expect(staleEpisodes.sql).toContain(
          '"episodes"."season_id" in (select "id" from "seasons" where ("seasons"."show_id" = $1 and "seasons"."number" not in ($2, $3)))',
        );
        expect(staleEpisodes.sql).toContain(
          'not exists (select "episode_id" from "user_episode_progress"',
        );
        expect(staleEpisodes.params).toEqual(['show-id', 1, 2]);

        const staleSeasons = deletes[3].where;
        expect(staleSeasons.sql).toContain('"seasons"."show_id" = $1');
        expect(staleSeasons.sql).toContain('"seasons"."number" not in ($2, $3)');
        expect(staleSeasons.sql).toContain(
          'not exists (select "id" from "episodes" where "episodes"."season_id" = "seasons"."id")',
        );
      });

      it('should not prune anything when the payload has no seasons', async () => {
        const module: TestingModule = await setup();
        repository = module.get(DrizzleShowRepository);
        const tx = createPruneTx();

        await repository.upsertDetails(tx, 'media-1', { totalEpisodes: 4 });

        expect(tx.delete).not.toHaveBeenCalled();
      });
    });

    it('should propagate errors', async () => {
      const errChain = createThenable([], new Error('DB Error'));
      const tx = { insert: jest.fn().mockReturnValue(errChain) } as any;
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      await expect(repository.upsertDetails(tx, 'media-1', {})).rejects.toThrow('DB Error');
    });
  });

  describe('saveDropOffAnalysis', () => {
    it('should update drop-off analysis when show exists', async () => {
      const module: TestingModule = await setup({
        resolveSelect: [{ mediaItemId: 'media-item-id' }],
      });
      repository = module.get(DrizzleShowRepository);

      await repository.saveDropOffAnalysis(1, { chart: [] } as any);
      expect(db.select).toHaveBeenCalled();
      expect(selectChain.innerJoin).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalled();
      expect(updateChain.where).toHaveBeenCalled();
    });

    it('should skip update when show not found', async () => {
      const module: TestingModule = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleShowRepository);

      await repository.saveDropOffAnalysis(1, { chart: [] } as any);
      expect(db.select).toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleShowRepository);

      await expect(repository.saveDropOffAnalysis(1, { chart: [] } as any)).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('findShowsForAnalysis', () => {
    it('should return shows', async () => {
      const module: TestingModule = await setup({ resolveSelect: [{ tmdbId: 1, title: 'Show' }] });
      repository = module.get(DrizzleShowRepository);

      const res = await repository.findShowsForAnalysis(5);
      expect(res).toEqual([{ tmdbId: 1, title: 'Show' }]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter soft-deleted shows and order stalest analysis first', async () => {
      const module: TestingModule = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleShowRepository);

      await repository.findShowsForAnalysis(5);

      const dialect = new PgDialect();
      const whereSql = dialect.sqlToQuery(selectChain.where.mock.calls[0][0]).sql;
      expect(whereSql).toContain('"deleted_at" is null');

      const [staleness] = selectChain.orderBy.mock.calls[0];
      expect(dialect.sqlToQuery(staleness).sql).toContain("->>'analyzedAt' ASC NULLS FIRST");
      expect(selectChain.limit).toHaveBeenCalledWith(5);
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleShowRepository);

      await expect(repository.findShowsForAnalysis(5)).rejects.toThrow(DatabaseException);
    });
  });

  describe('getDropOffAnalysis', () => {
    it('should return analysis when found', async () => {
      const module: TestingModule = await setup({
        resolveSelect: [{ dropOffAnalysis: { chart: [] } }],
      });
      repository = module.get(DrizzleShowRepository);

      const res = await repository.getDropOffAnalysis(1);
      expect(res).toEqual({ chart: [] });
    });

    it('should return null when not found', async () => {
      const module: TestingModule = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleShowRepository);

      const res = await repository.getDropOffAnalysis(1);
      expect(res).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleShowRepository);

      await expect(repository.getDropOffAnalysis(1)).rejects.toThrow(DatabaseException);
    });
  });

  describe('findIdentityBySlug', () => {
    it('should only match non-deleted shows (slug is unique per type, not globally)', async () => {
      const module: TestingModule = await setup({
        resolveSelect: [{ id: 'show-1', tmdbId: 7, lastSyncedAt: null }],
      });
      repository = module.get(DrizzleShowRepository);

      const result = await repository.findIdentityBySlug('some-slug');

      expect(result).toEqual({ id: 'show-1', tmdbId: 7, lastSyncedAt: null });
      const { sql: whereSql, params } = new PgDialect().sqlToQuery(
        selectChain.where.mock.calls[0][0],
      );
      expect(whereSql).toContain('"slug"');
      expect(whereSql).toContain('"type"');
      expect(whereSql).toContain('"deleted_at" is null');
      expect(params).toEqual(expect.arrayContaining(['some-slug', 'show']));
    });

    it('should return null when nothing matches', async () => {
      const module: TestingModule = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleShowRepository);

      await expect(repository.findIdentityBySlug('missing')).resolves.toBeNull();
    });
  });

  describe('delegating queries', () => {
    it('findBySlug delegates to showDetailsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const res = await repository.findBySlug('slug');
      expect(res).toEqual('details');
      expect(detailsQuery.execute).toHaveBeenCalledWith('slug');
    });

    it('findTrending delegates to trendingShowsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const res = await repository.findTrending({} as any);
      expect(res).toEqual(['trending']);
      expect(trendingQuery.execute).toHaveBeenCalled();
    });

    it('findPopular delegates to popularShowsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const res = await repository.findPopular({} as any);
      expect(res).toEqual(['popular']);
      expect(popularQuery.execute).toHaveBeenCalled();
    });

    it('findEpisodesByDateRange delegates to calendarEpisodesQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const start = new Date();
      const end = new Date();
      const res = await repository.findEpisodesByDateRange(start, end);
      expect(res).toEqual(['calendar']);
      expect(calendarQuery.execute).toHaveBeenCalledWith(start, end, undefined);
    });

    it('findEpisodesByDateRange passes options to calendarEpisodesQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const start = new Date();
      const end = new Date();
      const options = { viewerId: 'user-123', personalized: true };
      await repository.findEpisodesByDateRange(start, end, options);
      expect(calendarQuery.execute).toHaveBeenCalledWith(start, end, options);
    });
  });
});
