import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { MediaType } from '@/common/enums/media-type.enum';
import { DatabaseException } from '@/common/exceptions/database.exception';

import { RottenTomatoesBackfillRepository } from './rotten-tomatoes-backfill.repository';

const buildDb = (rows: unknown[] | Error = []) => {
  const terminal = rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
  const chain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue(terminal),
  };
  const updateSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
  return {
    db: {
      select: jest.fn().mockReturnValue(chain),
      update: jest.fn().mockReturnValue({ set: updateSet }),
    },
    chain,
    updateSet,
  };
};

const renderWhere = (where: jest.Mock) => new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);

describe('RottenTomatoesBackfillRepository', () => {
  describe('findCandidates', () => {
    it('pages by id after the cursor with the requested limit', async () => {
      const rows = [{ id: 'media-1', tmdbId: 1, type: MediaType.MOVIE }];
      const { db, chain } = buildDb(rows);
      const fetchedBefore = new Date('2026-01-01T00:00:00.000Z');

      const result = await new RottenTomatoesBackfillRepository(db as never).findCandidates({
        fetchedBefore,
        cursor: 'cursor-1',
        limit: 250,
      });

      expect(result).toEqual(rows);
      expect(chain.limit).toHaveBeenCalledWith(250);
      const { sql, params } = renderWhere(chain.where);
      expect(sql).toContain('"rt_fetched_at" < $');
      expect(sql).toContain('"id" > $');
      expect(params).toEqual(expect.arrayContaining([fetchedBefore.toISOString(), 'cursor-1']));
    });

    it('wraps database failures in DatabaseException', async () => {
      const { db } = buildDb(new Error('connection lost'));

      await expect(
        new RottenTomatoesBackfillRepository(db as never).findCandidates({
          fetchedBefore: new Date(),
          limit: 10,
        }),
      ).rejects.toBeInstanceOf(DatabaseException);
    });
  });

  describe('findLastFetchedAt', () => {
    it('returns the stored rtFetchedAt', async () => {
      const fetchedAt = new Date();
      const { db } = buildDb([{ rtFetchedAt: fetchedAt }]);

      await expect(
        new RottenTomatoesBackfillRepository(db as never).findLastFetchedAt('media-1'),
      ).resolves.toBe(fetchedAt);
    });

    it('returns null when the row is missing', async () => {
      const { db } = buildDb([]);

      await expect(
        new RottenTomatoesBackfillRepository(db as never).findLastFetchedAt('media-1'),
      ).resolves.toBeNull();
    });
  });

  describe('saveFetchResult', () => {
    const fetchedAt = new Date('2026-02-01T00:00:00.000Z');

    const save = async (
      critics: number | null,
      audience: number | null,
      ratingsChangedAt: Date | null,
    ) => {
      const { db, updateSet } = buildDb();
      await new RottenTomatoesBackfillRepository(db as never).saveFetchResult('media-1', {
        fetchedAt,
        ratings: { rottenTomatoesCritics: critics, rottenTomatoesAudience: audience },
        ratingsChangedAt,
      });
      return updateSet.mock.calls[0][0];
    };

    it('writes both scores and the change time', async () => {
      await expect(save(78, 76, fetchedAt)).resolves.toEqual({
        rtFetchedAt: fetchedAt,
        ratingRottenTomatoes: 78,
        ratingRottenTomatoesAudience: 76,
        updatedAt: fetchedAt,
      });
    });

    it('keeps the stored audience score when only critics is returned', async () => {
      const payload = await save(78, null, fetchedAt);

      expect(payload).toHaveProperty('ratingRottenTomatoes', 78);
      expect(payload).not.toHaveProperty('ratingRottenTomatoesAudience');
    });

    it('keeps the stored critics score when only audience is returned', async () => {
      const payload = await save(null, 80, fetchedAt);

      expect(payload).toHaveProperty('ratingRottenTomatoesAudience', 80);
      expect(payload).not.toHaveProperty('ratingRottenTomatoes');
    });

    it('stamps only rtFetchedAt when nothing changed', async () => {
      await expect(save(null, null, null)).resolves.toEqual({ rtFetchedAt: fetchedAt });
    });
  });
});
