import { PgDialect } from 'drizzle-orm/pg-core';

import { onlyShowsAwaitingPremiere } from './show-premiere-conditions';

const render = (condition: Parameters<PgDialect['sqlToQuery']>[0]) =>
  new PgDialect().sqlToQuery(condition);

describe('onlyShowsAwaitingPremiere', () => {
  const asOf = new Date('2026-11-20T12:00:00.000Z');

  it('keeps shows linked to the media item', () => {
    const { sql } = render(onlyShowsAwaitingPremiere(asOf));

    expect(sql).toMatch(/^exists \(select 1 from "shows" where/);
    expect(sql).toContain('"shows"."media_item_id" = "media_items"."id"');
  });

  it('requires a first air date after now or an undated unreleased status', () => {
    const { sql, params } = render(onlyShowsAwaitingPremiere(asOf));

    expect(sql).toContain('"media_items"."release_date" > $1');
    expect(sql).toContain('"media_items"."release_date" is null');
    expect(sql).toMatch(/"shows"\."status" in \(\$2, \$3, \$4\)/);
    expect(params.slice(1, 4)).toEqual(['Planned', 'In Production', 'Pilot']);
  });

  it('excludes shows with a regular episode aired by now', () => {
    const { sql, params } = render(onlyShowsAwaitingPremiere(asOf));

    expect(sql).toContain('not exists (select 1 from "episodes" inner join "seasons"');
    expect(sql).toContain('"seasons"."number" > $5');
    expect(sql).toContain('"episodes"."air_date" <= $6');
    expect(params[4]).toBe(0);
  });
});
