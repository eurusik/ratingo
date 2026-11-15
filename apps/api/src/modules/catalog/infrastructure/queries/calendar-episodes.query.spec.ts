import { PgDialect } from 'drizzle-orm/pg-core';

import { CalendarEpisodesQuery } from './calendar-episodes.query';
import { DatabaseException } from '@/common/exceptions/database.exception';
import * as schema from '@/database/schema';

const dialect = new PgDialect();

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'innerJoin', 'leftJoin', 'where', 'orderBy'];
  methods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

const rawRow = (overrides: Record<string, unknown> = {}) => ({
  episodeId: 'e1',
  showId: 's1',
  showRecordId: 'r1',
  showSlug: 'show-slug',
  showTitle: 'Show',
  posterPath: '/p.jpg',
  showPopularity: 42,
  seasonNumber: 2,
  seasonEpisodeCount: 8,
  episodeNumber: 5,
  title: 'Ep',
  overview: 'ov',
  airDate: new Date('2024-05-10'),
  runtime: 45,
  stillPath: '/still.jpg',
  isTracked: true,
  isSaved: false,
  isWatched: true,
  ...overrides,
});

describe('CalendarEpisodesQuery', () => {
  let db: any;
  let query: CalendarEpisodesQuery;

  const setup = (rows: any[], reject?: Error) => {
    db = { select: jest.fn().mockImplementation(() => createThenable(rows, reject)) };
    query = new CalendarEpisodesQuery(db as any);
  };

  const builder = () => db.select.mock.results[0].value;
  const whereSql = () => dialect.sqlToQuery(builder().where.mock.calls[0][0]);

  it('maps episodes with viewer state', async () => {
    setup([rawRow()]);

    const res = await query.execute(new Date('2024-05-01'), new Date('2024-05-31'), {
      viewerId: 'user-1',
      personalized: false,
    });

    expect(res).toEqual([rawRow()]);
  });

  it('defaults missing popularity to 0 and unknown season size to null', async () => {
    setup([rawRow({ showPopularity: null, seasonEpisodeCount: 0 })]);

    const [episode] = await query.execute(new Date(), new Date());

    expect(episode.showPopularity).toBe(0);
    expect(episode.seasonEpisodeCount).toBeNull();
  });

  const leftJoinSql = (table: string) => {
    const call = builder().leftJoin.mock.calls.find(
      ([joined]: [unknown]) => joined === (schema as Record<string, unknown>)[table],
    );
    return dialect.sqlToQuery(call[1]);
  };

  it('never matches viewer rows for anonymous requests', async () => {
    setup([]);

    await query.execute(new Date(), new Date());

    for (const table of ['userMediaState', 'userSavedItems', 'userEpisodeProgress']) {
      expect(leftJoinSql(table).sql).toContain('false');
    }
  });

  it('joins viewer state only for the viewer', async () => {
    setup([]);

    await query.execute(new Date(), new Date(), { viewerId: 'user-1', personalized: false });

    expect(leftJoinSql('userMediaState').params).toEqual(['user-1']);
    expect(leftJoinSql('userSavedItems').params).toEqual(['for_later', 'user-1']);
    expect(leftJoinSql('userEpisodeProgress').params).toEqual(['user-1']);
  });

  it('limits personalized results to tracked shows and premieres of saved shows', async () => {
    setup([]);

    await query.execute(new Date(), new Date(), { viewerId: 'user-1', personalized: true });

    const { sql, params } = whereSql();
    expect(sql).toMatch(/coalesce\("user_media_state"."state" = \$\d+, false\) or/);
    expect(sql).toContain('"user_saved_items"."id" is not null');
    expect(sql).toContain('"episodes"."number" = $');
    expect(sql).toContain('"seasons"."number" > $');
    expect(params).toEqual(expect.arrayContaining(['watching', 1, 0]));
  });

  it('does not filter by viewer when not personalized', async () => {
    setup([]);

    await query.execute(new Date(), new Date(), { viewerId: 'user-1', personalized: false });

    expect(whereSql().sql).not.toContain('user_media_state');
  });

  it('orders by air time, popularity and id for a stable order', async () => {
    setup([]);

    await query.execute(new Date(), new Date());

    const order = builder().orderBy.mock.calls[0].map(
      (part: Parameters<typeof dialect.sqlToQuery>[0]) => dialect.sqlToQuery(part).sql,
    );
    expect(order.join(', ')).toBe(
      '"episodes"."air_date" asc, "media_items"."popularity" desc nulls last, "episodes"."id" asc',
    );
  });

  it('throws DatabaseException on error', async () => {
    setup([], new Error('DB error'));
    await expect(query.execute(new Date(), new Date())).rejects.toThrow(DatabaseException);
  });
});
