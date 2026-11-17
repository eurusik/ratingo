import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DatabaseException } from '@/common/exceptions/database.exception';

import { UpcomingMoviesQuery } from './upcoming-movies.query';

const dialect = new PgDialect();

const chain = (result: unknown, reject?: Error) => {
  const builder: Record<string, jest.Mock | ((...args: never[]) => unknown)> = {};
  for (const method of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset']) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: never, rejectFn: never) =>
    (reject ? Promise.reject(reject) : Promise.resolve(result)).then(resolve, rejectFn);
  return builder;
};

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  mediaItemId: 'm1',
  tmdbId: 101,
  title: 'Soon',
  slug: 'soon',
  overview: null,
  ingestionStatus: 'ready',
  posterPath: null,
  backdropPath: null,
  popularity: 77,
  rating: null,
  voteCount: null,
  releaseDate: new Date('2026-08-01T00:00:00.000Z'),
  ratingImdb: null,
  voteCountImdb: null,
  ratingTrakt: null,
  voteCountTrakt: null,
  ratingMetacritic: null,
  ratingRottenTomatoes: null,
  ratingRottenTomatoesAudience: null,
  theatricalReleaseDate: new Date('2026-12-05T00:00:00.000Z'),
  digitalReleaseDate: null,
  runtime: null,
  ratingoScore: null,
  qualityScore: null,
  popularityScore: null,
  watchersCount: null,
  totalWatchers: null,
  releases: [{ country: 'US', type: 3, date: '2026-12-05T00:00:00.000Z' }],
  ...overrides,
});

describe('UpcomingMoviesQuery', () => {
  const options = {
    from: new Date('2026-11-17T00:00:00.000Z'),
    toExclusive: new Date('2027-03-18T00:00:00.000Z'),
    limit: 10,
    offset: 20,
  };
  const genres = [{ id: 'g1', slug: 'drama', name: 'Drama' }];

  const setup = (rows: unknown[], reject?: Error) => {
    const rowsQuery = chain(rows, reject);
    const countQuery = chain([{ total: '42' }]);
    const db = { select: jest.fn().mockReturnValueOnce(rowsQuery).mockReturnValueOnce(countQuery) };
    const genreQuery = {
      fetchForMediaItems: jest.fn().mockResolvedValue(new Map([['m1', genres]])),
    };
    const query = new UpcomingMoviesQuery(db as never, genreQuery as never);
    return { query, rowsQuery, countQuery, genreQuery };
  };

  const whereSql = (builder: Record<string, unknown>) =>
    dialect.sqlToQuery((builder.where as jest.Mock).mock.calls[0][0] as SQL);

  it('maps rows with their release label, genres and total', async () => {
    const { query } = setup([row()]);

    const result = await query.execute(options);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'm1',
      popularity: 77,
      genres,
      effectiveReleaseDate: new Date('2026-12-05T00:00:00.000Z'),
      releaseDateKind: 'theatrical',
      releaseCountry: 'US',
    });
    expect(result.total).toBe(42);
  });

  it('keeps movies eligible in the upcoming context that release within the window', async () => {
    const { query, rowsQuery, countQuery } = setup([]);

    await query.execute(options);

    const { sql, params } = whereSql(rowsQuery);
    expect(sql).toContain('"media_catalog_evaluations"."context" in ($');
    expect(sql).toMatch(/coalesce\(.*\) >= \$\d+ and coalesce\(.*\) < \$\d+/);
    expect(params).toEqual(
      expect.arrayContaining([
        'upcoming',
        'eligible',
        options.from.toISOString(),
        options.toExclusive.toISOString(),
      ]),
    );
    expect(params).not.toContain('catalog');
    expect(whereSql(countQuery).sql).toBe(sql);
  });

  it('pages by TMDB popularity', async () => {
    const { query, rowsQuery } = setup([]);

    await query.execute(options);

    const [order] = (rowsQuery.orderBy as jest.Mock).mock.calls[0] as SQL[];
    expect(dialect.sqlToQuery(order).sql).toBe('"media_items"."popularity" desc nulls last');
    expect(rowsQuery.limit).toHaveBeenCalledWith(10);
    expect(rowsQuery.offset).toHaveBeenCalledWith(20);
  });

  it('wraps database failures', async () => {
    const { query } = setup([], new Error('down'));

    await expect(query.execute(options)).rejects.toBeInstanceOf(DatabaseException);
  });
});
