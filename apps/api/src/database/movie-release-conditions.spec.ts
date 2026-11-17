import { PgDialect } from 'drizzle-orm/pg-core';

import {
  effectiveMovieReleaseDate,
  excludeUnreleasedMovies,
  onlyMoviesReleasingFrom,
} from './movie-release-conditions';

const render = (condition: Parameters<PgDialect['sqlToQuery']>[0]) =>
  new PgDialect().sqlToQuery(condition);

describe('movie-release-conditions', () => {
  it('prefers theatrical, then digital, then the primary release date', () => {
    const { sql } = render(effectiveMovieReleaseDate());

    expect(sql).toBe(
      'coalesce("movies"."theatrical_release_date", "movies"."digital_release_date", "media_items"."release_date")',
    );
  });

  it('excludes movies whose effective release date is after now', () => {
    const now = new Date('2026-11-17T00:00:00.000Z');
    const { sql, params } = render(excludeUnreleasedMovies(now));

    expect(sql).toContain('not exists (select 1 from "movies" where');
    expect(sql).toContain('"movies"."media_item_id" = "media_items"."id"');
    expect(sql).toMatch(/coalesce\(.*\) > \$1/);
    expect(params).toEqual([now.toISOString()]);
  });

  it('keeps only movies whose effective release date is on or after the given day', () => {
    const today = new Date('2026-11-17T00:00:00.000Z');
    const { sql, params } = render(onlyMoviesReleasingFrom(today));

    expect(sql).toMatch(/^exists \(select 1 from "movies" where/);
    expect(sql).toMatch(/coalesce\(.*\) >= \$1/);
    expect(params).toEqual([today.toISOString()]);
  });
});
