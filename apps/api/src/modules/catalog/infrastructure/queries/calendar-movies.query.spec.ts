import { drizzle } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '@/common/exceptions/database.exception';
import * as schema from '@/database/schema';

import { CalendarMoviesQuery } from './calendar-movies.query';

const range = {
  from: new Date('2026-11-20T00:00:00.000Z'),
  toExclusive: new Date('2026-11-27T00:00:00.000Z'),
};

const row = (overrides: Record<string, unknown> = {}) => ({
  mediaItemId: 'm1',
  tmdbId: 101,
  slug: 'soon',
  title: 'Soon',
  posterPath: '/p.jpg',
  backdropPath: '/b.jpg',
  popularity: 55,
  releaseDate: new Date('2026-10-01T00:00:00.000Z'),
  theatricalReleaseDate: null,
  digitalReleaseDate: new Date('2026-11-21T00:00:00.000Z'),
  releases: [{ country: 'US', type: 4, date: '2026-11-21T00:00:00.000Z' }],
  isSavedForLater: true,
  isReminderSet: false,
  releaseDay: '2026-11-21',
  dayRank: 1,
  dayCount: '7',
  ...overrides,
});

describe('CalendarMoviesQuery', () => {
  const query = new CalendarMoviesQuery(drizzle.mock({ schema }));
  const render = (options: Parameters<CalendarMoviesQuery['select']>[1]) =>
    query.select(range, options).toSQL();

  afterEach(() => jest.restoreAllMocks());

  it('ranks movies by TMDB popularity within each release day', () => {
    const { sql } = render({});

    expect(sql).toContain('row_number() over (partition by to_char(coalesce(');
    expect(sql).toContain('"media_items"."popularity" desc nulls last');
    expect(sql).toContain('count(*) over (partition by to_char(coalesce(');
  });

  it('keeps the movies eligible in the upcoming or catalog context of the active policy', () => {
    const { sql, params } = render({ perDayLimit: 5 });

    expect(sql).toContain('"catalog_policies"."is_active" = $');
    expect(sql).toContain('"media_catalog_evaluations"."context" in ($');
    expect(params).toEqual(expect.arrayContaining(['upcoming', 'catalog', 'eligible', 5]));
    expect(sql).toContain('"day_rank" <= $');
    expect(sql).toMatch(/\) < \$\d+/);
    expect(params).toEqual(
      expect.arrayContaining([range.from.toISOString(), range.toExclusive.toISOString()]),
    );
  });

  it("lists only the viewer's saved or reminded movies without a per-day limit", () => {
    const { sql, params } = render({ viewerId: 'user-1', personalized: true });

    expect(sql).not.toContain('"media_catalog_evaluations"');
    expect(sql).not.toContain('"day_rank" <=');
    expect(sql).toContain('"user_media_state"."state" = $');
    expect(sql).toContain('"user_saved_items"."list" = $');
    expect(sql).toContain('"user_subscriptions"."trigger" = $');
    expect(params).toEqual(
      expect.arrayContaining(['user-1', 'planned', 'for_later', 'release', true]),
    );
  });

  it('checks viewer flags only for the movies kept after ranking', () => {
    const { sql } = render({ viewerId: 'user-1', perDayLimit: 5 });

    expect(sql).toMatch(/"user_subscriptions"\."media_item_id" = "ranked"\."id"/);
    expect(sql).not.toMatch(/"user_subscriptions"\."media_item_id" = "media_items"\."id"/);
  });

  it('marks anonymous viewers as having nothing saved', () => {
    const { sql } = render({});

    expect(sql).not.toContain('"user_subscriptions"');
    expect(sql).toContain('false');
  });

  it('maps rows to calendar movies and counts movies per day', async () => {
    jest.spyOn(query, 'select').mockReturnValue(Promise.resolve([row()]) as never);

    const result = await query.execute(range, { perDayLimit: 5 });

    expect(result.movies).toEqual([
      {
        mediaItemId: 'm1',
        tmdbId: 101,
        slug: 'soon',
        title: 'Soon',
        poster: expect.objectContaining({ small: expect.stringContaining('/p.jpg') }),
        backdrop: expect.objectContaining({ thumb: expect.stringContaining('/w300/b.jpg') }),
        releaseDate: new Date('2026-11-21T00:00:00.000Z'),
        releaseDateKind: 'digital',
        releaseCountry: 'US',
        popularity: 55,
        isSavedForLater: true,
        isReminderSet: false,
      },
    ]);
    expect(result.movieCountByDay.get('2026-11-21')).toBe(7);
  });

  it('wraps database failures', async () => {
    jest.spyOn(query, 'select').mockReturnValue(Promise.reject(new Error('down')) as never);

    await expect(query.execute(range)).rejects.toBeInstanceOf(DatabaseException);
  });
});
