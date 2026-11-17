import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DatabaseException } from '@/common/exceptions/database.exception';

import { DrizzleSitemapRepository } from './drizzle-sitemap.repository';

const buildDb = (orderByResult: Promise<unknown>) => {
  const orderBy = jest.fn().mockReturnValue(orderByResult);
  const where = jest.fn().mockReturnValue({ orderBy });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { db: { select }, where, orderBy };
};

const renderWhere = (where: jest.Mock) => {
  const [condition] = where.mock.calls[0] as [SQL];
  return new PgDialect().sqlToQuery(condition);
};

describe('DrizzleSitemapRepository', () => {
  const now = new Date('2026-11-17T00:00:00.000Z');

  it('returns released movies ordered by slug', async () => {
    const updatedAt = new Date('2026-01-02T03:04:05.000Z');
    const { db, where, orderBy } = buildDb(Promise.resolve([{ slug: 'dune', updatedAt }]));
    const repository = new DrizzleSitemapRepository(db as never);

    const items = await repository.findReleasedMovies(now);

    expect(items).toEqual([{ slug: 'dune', updatedAt }]);
    expect(orderBy).toHaveBeenCalledTimes(1);
    const { sql, params } = renderWhere(where);
    expect(sql).toContain('not exists (select 1 from "movies" where');
    expect(params).toEqual(expect.arrayContaining(['movie', now.toISOString()]));
  });

  it('does not filter shows by movie release dates', async () => {
    const { db, where } = buildDb(Promise.resolve([]));
    const repository = new DrizzleSitemapRepository(db as never);

    await repository.findReadyShows();

    const { sql, params } = renderWhere(where);
    expect(sql).not.toContain('"movies"');
    expect(params).toContain('show');
  });

  it('wraps database failures in DatabaseException', async () => {
    const { db } = buildDb(Promise.reject(new Error('connection lost')));
    const repository = new DrizzleSitemapRepository(db as never);

    await expect(repository.findReadyShows()).rejects.toBeInstanceOf(DatabaseException);
  });
});
