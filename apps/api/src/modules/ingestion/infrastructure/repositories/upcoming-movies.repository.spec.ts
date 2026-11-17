import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DatabaseException } from '@/common/exceptions/database.exception';

import { UpcomingMoviesRepository } from './upcoming-movies.repository';

const buildDb = (rows: unknown[] | Error = []) => {
  const terminal = rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
  const chain = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue(terminal),
  };
  return { db: { select: jest.fn().mockReturnValue(chain) }, chain };
};

const renderWhere = (where: jest.Mock) => new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);

const query = {
  releasedAfter: new Date('2026-11-03T00:00:00.000Z'),
  releasedBefore: new Date('2026-12-01T00:00:00.000Z'),
  syncedBefore: new Date('2026-11-16T16:00:00.000Z'),
  limit: 500,
};

describe('UpcomingMoviesRepository', () => {
  it('returns tmdb ids of movies inside the release window that were not synced recently', async () => {
    const { db, chain } = buildDb([{ tmdbId: 1 }, { tmdbId: 2 }]);

    const result = await new UpcomingMoviesRepository(db as never).findTmdbIdsToRefresh(query);

    expect(result).toEqual([1, 2]);
    expect(chain.limit).toHaveBeenCalledWith(500);
    const { sql, params } = renderWhere(chain.where);
    expect(sql).toContain('"media_items"."type" = $');
    expect(sql).toMatch(/coalesce\(.*\) > \$/);
    expect(sql).toMatch(/coalesce\(.*\) <= \$/);
    expect(sql).toContain('"media_items"."last_synced_at" is null');
    expect(params).toEqual(
      expect.arrayContaining([
        'movie',
        query.releasedAfter.toISOString(),
        query.releasedBefore.toISOString(),
        query.syncedBefore.toISOString(),
      ]),
    );
  });

  it('refreshes the least recently synced movies first', async () => {
    const { db, chain } = buildDb([]);

    await new UpcomingMoviesRepository(db as never).findTmdbIdsToRefresh(query);

    const [lastSynced, releaseDate] = chain.orderBy.mock.calls[0] as SQL[];
    expect(new PgDialect().sqlToQuery(lastSynced).sql).toBe(
      '"media_items"."last_synced_at" asc nulls first',
    );
    expect(new PgDialect().sqlToQuery(releaseDate).sql).toMatch(/^coalesce\(.*\) asc$/);
  });

  it('has no upper release bound when releasedBefore is null', async () => {
    const { db, chain } = buildDb([]);

    await new UpcomingMoviesRepository(db as never).findTmdbIdsToRefresh({
      ...query,
      releasedBefore: null,
    });

    expect(renderWhere(chain.where).sql).not.toMatch(/<= \$/);
  });

  it('wraps database failures in DatabaseException', async () => {
    const { db } = buildDb(new Error('connection lost'));

    await expect(
      new UpcomingMoviesRepository(db as never).findTmdbIdsToRefresh(query),
    ).rejects.toBeInstanceOf(DatabaseException);
  });
});
