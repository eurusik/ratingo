import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { MediaType } from '@/common/enums/media-type.enum';
import { DatabaseException } from '@/common/exceptions/database.exception';

import { ImdbBackfillRepository } from './imdb-backfill.repository';

const render = (condition: unknown) => new PgDialect().sqlToQuery(condition as SQL);

const buildSelectDb = (rows: unknown[] | Error) => {
  const chain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest
      .fn()
      .mockReturnValue(rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows)),
  };
  return { db: { select: jest.fn().mockReturnValue(chain) }, chain };
};

describe('ImdbBackfillRepository', () => {
  describe('findShowCandidates', () => {
    it('returns shows missing an IMDb id after the cursor', async () => {
      const rows = [{ id: 'media-2', tmdbId: 2 }];
      const { db, chain } = buildSelectDb(rows);

      const result = await new ImdbBackfillRepository(db as never).findShowCandidates({
        cursor: 'media-1',
        limit: 100,
      });

      expect(result).toEqual(rows);
      expect(chain.limit).toHaveBeenCalledWith(100);
      const { sql, params } = render(chain.where.mock.calls[0][0]);
      expect(sql).toContain('"imdb_id" is null');
      expect(params).toEqual(expect.arrayContaining([MediaType.SHOW, 'media-1']));
    });

    it('wraps database failures in DatabaseException', async () => {
      const { db } = buildSelectDb(new Error('connection lost'));

      await expect(
        new ImdbBackfillRepository(db as never).findShowCandidates({ limit: 100 }),
      ).rejects.toBeInstanceOf(DatabaseException);
    });
  });

  describe('saveShowImdbId', () => {
    it('sets the imdbId on the show with the given TMDB id', async () => {
      const where = jest.fn().mockResolvedValue(undefined);
      const set = jest.fn().mockReturnValue({ where });
      const db = { update: jest.fn().mockReturnValue({ set }) };

      await new ImdbBackfillRepository(db as never).saveShowImdbId(42, 'tt0000042');

      expect(set).toHaveBeenCalledWith({ imdbId: 'tt0000042' });
      const { sql, params } = render(where.mock.calls[0][0]);
      expect(sql).toContain('"tmdb_id" = $');
      expect(params).toEqual(expect.arrayContaining([42, MediaType.SHOW]));
    });
  });
});
