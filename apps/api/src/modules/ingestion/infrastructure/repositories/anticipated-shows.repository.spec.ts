import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DatabaseException } from '@/common/exceptions/database.exception';

import { AnticipatedShowsRepository } from './anticipated-shows.repository';

const render = (condition: SQL) => new PgDialect().sqlToQuery(condition);

const buildSelectDb = (rows: unknown[] | Error = []) => {
  const terminal = rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
  const chain = {
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockImplementation(() => Object.assign(terminal, chain)),
    limit: jest.fn().mockReturnValue(terminal),
  };
  chain.from.mockImplementation(() => Object.assign(Promise.resolve(rows), chain));
  return { db: { select: jest.fn().mockReturnValue(chain) }, chain };
};

const buildTxDb = () => {
  const values = jest.fn().mockResolvedValue(undefined);
  const tx = {
    delete: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockReturnValue({ values }),
  };
  const db = { transaction: jest.fn((fn: (t: typeof tx) => Promise<void>) => fn(tx)) };
  return { db, tx, values };
};

describe('AnticipatedShowsRepository', () => {
  describe('replaceSnapshot', () => {
    it('replaces the whole snapshot in one transaction', async () => {
      const { db, tx, values } = buildTxDb();
      const fetchedAt = new Date('2026-11-20T05:30:00.000Z');

      await new AnticipatedShowsRepository(db as never).replaceSnapshot(
        [{ tmdbId: 1, listCount: 60_000, rank: 1 }],
        fetchedAt,
      );

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.delete).toHaveBeenCalled();
      expect(values).toHaveBeenCalledWith([{ tmdbId: 1, listCount: 60_000, rank: 1, fetchedAt }]);
    });
  });

  describe('findMissingTmdbIds', () => {
    it('returns snapshot shows above the threshold with no show row in the catalog', async () => {
      const { db, chain } = buildSelectDb([{ tmdbId: 5 }]);

      const result = await new AnticipatedShowsRepository(db as never).findMissingTmdbIds(1000);

      expect(result).toEqual([5]);
      const join = render(chain.leftJoin.mock.calls[0][1] as SQL);
      expect(join.sql).toContain('"media_items"."tmdb_id" = "trakt_anticipated_shows"."tmdb_id"');
      expect(join.params).toContain('show');
      const where = render(chain.where.mock.calls[0][0] as SQL);
      expect(where.sql).toContain('"trakt_anticipated_shows"."list_count" >= $1');
      expect(where.sql).toContain('"media_items"."id" is null');
      expect(where.params).toEqual([1000]);
    });
  });

  describe('findTmdbIdsToRefresh', () => {
    it('returns the least recently synced anticipated shows not synced since the cutoff', async () => {
      const { db, chain } = buildSelectDb([{ tmdbId: 9 }]);
      const syncedBefore = new Date('2026-11-19T09:30:00.000Z');

      const result = await new AnticipatedShowsRepository(db as never).findTmdbIdsToRefresh({
        minListCount: 1000,
        syncedBefore,
        limit: 100,
      });

      expect(result).toEqual([9]);
      expect(chain.limit).toHaveBeenCalledWith(100);
      const where = render(chain.where.mock.calls[0][0] as SQL);
      expect(where.sql).toContain('"media_items"."deleted_at" is null');
      expect(where.sql).toContain('"media_items"."last_synced_at" is null');
      expect(where.params).toEqual(expect.arrayContaining([1000, syncedBefore.toISOString()]));
      expect(render(chain.orderBy.mock.calls[0][0] as SQL).sql).toBe(
        '"media_items"."last_synced_at" asc nulls first',
      );
    });

    it('wraps database errors', async () => {
      const { db } = buildSelectDb(new Error('boom'));

      await expect(
        new AnticipatedShowsRepository(db as never).findTmdbIdsToRefresh({
          minListCount: 1000,
          syncedBefore: new Date(),
          limit: 100,
        }),
      ).rejects.toBeInstanceOf(DatabaseException);
    });
  });

  describe('findLatestFetchedAt', () => {
    it('returns the latest fetch time or null for an empty snapshot', async () => {
      const fetchedAt = new Date('2026-11-20T05:30:00.000Z');

      await expect(
        new AnticipatedShowsRepository(
          buildSelectDb([{ fetchedAt }]).db as never,
        ).findLatestFetchedAt(),
      ).resolves.toBe(fetchedAt);
      await expect(
        new AnticipatedShowsRepository(
          buildSelectDb([{ fetchedAt: null }]).db as never,
        ).findLatestFetchedAt(),
      ).resolves.toBeNull();
    });
  });
});
