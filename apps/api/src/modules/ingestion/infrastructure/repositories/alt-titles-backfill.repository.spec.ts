import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

import { AltTitlesBackfillRepository } from './alt-titles-backfill.repository';

const buildDb = (rows: unknown[] | Error) => {
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

describe('AltTitlesBackfillRepository', () => {
  it('returns items without alternative titles after the cursor', async () => {
    const rows = [
      { id: 'media-2', tmdbId: 2, type: MediaType.SHOW, title: 'Title', originalTitle: null },
    ];
    const { db, chain } = buildDb(rows);

    const result = await new AltTitlesBackfillRepository(db as never).findCandidates({
      cursor: 'media-1',
      limit: 50,
    });

    expect(result).toEqual(rows);
    expect(chain.limit).toHaveBeenCalledWith(50);
    const { sql, params } = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0] as SQL);
    expect(sql).toContain('"alternative_titles" is null');
    expect(sql).toContain('"id" > $');
    expect(params).toContain('media-1');
  });

  it('omits the cursor condition on the first page', async () => {
    const { db, chain } = buildDb([]);

    await new AltTitlesBackfillRepository(db as never).findCandidates({ limit: 50 });

    const { sql } = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0] as SQL);
    expect(sql).not.toContain('"id" >');
  });

  it('wraps database failures in DatabaseException', async () => {
    const { db } = buildDb(new Error('connection lost'));

    await expect(
      new AltTitlesBackfillRepository(db as never).findCandidates({ limit: 50 }),
    ).rejects.toBeInstanceOf(DatabaseException);
  });
});
