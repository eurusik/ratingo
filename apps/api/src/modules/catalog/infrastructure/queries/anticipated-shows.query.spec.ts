import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DatabaseException } from '@/common/exceptions/database.exception';

import { AnticipatedShowsQuery } from './anticipated-shows.query';

const dialect = new PgDialect();

const chain = (result: unknown, reject?: Error) => {
  const builder: Record<string, jest.Mock | ((...args: never[]) => unknown)> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit']) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: never, rejectFn: never) =>
    (reject ? Promise.reject(reject) : Promise.resolve(result)).then(resolve, rejectFn);
  return builder;
};

const options = {
  from: new Date('2026-11-20T00:00:00.000Z'),
  toExclusive: new Date('2027-02-19T00:00:00.000Z'),
  minListCount: 1000,
  limit: 20,
};

const row = (overrides: Record<string, unknown> = {}) => ({
  mediaItemId: 'm1',
  slug: 'harry-potter',
  title: 'Гаррі Поттер',
  posterPath: '/hp.jpg',
  premiereDate: new Date('2026-12-25T00:00:00.000Z'),
  listCount: 60000,
  ...overrides,
});

describe('AnticipatedShowsQuery', () => {
  const run = async (rows: unknown[]) => {
    const builder = chain(rows);
    const db = { select: jest.fn().mockReturnValue(builder) };
    const result = await new AnticipatedShowsQuery(db as never).execute(options);
    return { result, builder };
  };

  it('maps rows to anticipated shows with poster images', async () => {
    const { result } = await run([row()]);

    expect(result).toEqual([
      {
        mediaItemId: 'm1',
        slug: 'harry-potter',
        title: 'Гаррі Поттер',
        poster: expect.objectContaining({ small: expect.stringContaining('/hp.jpg') }),
        premiereDate: new Date('2026-12-25T00:00:00.000Z'),
        listCount: 60000,
      },
    ]);
  });

  it('filters by threshold, premiere window, poster and upcoming eligibility under the active policy', async () => {
    const { builder } = await run([]);

    const { sql, params } = dialect.sqlToQuery(
      (builder.where as jest.Mock).mock.calls[0][0] as SQL,
    );
    expect(sql).toContain('"trakt_anticipated_shows"."list_count" >= $');
    expect(sql).toContain('"media_items"."poster_path" is not null');
    expect(sql).toContain('"media_items"."release_date" >= $');
    expect(sql).toContain('"media_items"."release_date" < $');
    expect(sql).toContain('"catalog_policies"."is_active" = $');
    expect(params).toEqual(
      expect.arrayContaining([
        1000,
        'upcoming',
        options.from.toISOString(),
        options.toExclusive.toISOString(),
      ]),
    );
    expect((builder.limit as jest.Mock).mock.calls[0][0]).toBe(20);
  });

  it('orders by premiere date, then by list count', async () => {
    const { builder } = await run([]);

    const [byDate, byLists] = (builder.orderBy as jest.Mock).mock.calls[0] as SQL[];
    expect(dialect.sqlToQuery(byDate).sql).toBe('"media_items"."release_date" asc');
    expect(dialect.sqlToQuery(byLists).sql).toBe('"trakt_anticipated_shows"."list_count" desc');
  });

  it('wraps database errors', async () => {
    const db = { select: jest.fn().mockReturnValue(chain([], new Error('boom'))) };

    await expect(new AnticipatedShowsQuery(db as never).execute(options)).rejects.toBeInstanceOf(
      DatabaseException,
    );
  });
});
