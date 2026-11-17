import { and, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { MOVIE_LISTING_TYPE, MovieListingsQuery } from './movie-listings.query';
import { buildWatchingNowConditions } from './shared/watching-now-conditions.builder';

const render = (conditions: SQL[]) => new PgDialect().sqlToQuery(and(...conditions)!).sql;

const typeConditions = (type: (typeof MOVIE_LISTING_TYPE)[keyof typeof MOVIE_LISTING_TYPE]) =>
  (
    new MovieListingsQuery({} as never, {} as never) as unknown as {
      buildTypeConditions: (t: typeof type) => SQL[];
    }
  ).buildTypeConditions(type);

describe('unreleased movies stay out of existing listings', () => {
  it('new releases require a theatrical date that is not in the future', () => {
    expect(render(typeConditions(MOVIE_LISTING_TYPE.NEW_RELEASES))).toContain(
      '"movies"."theatrical_release_date" <= $',
    );
  });

  it('new on digital requires a digital date that is not in the future', () => {
    expect(render(typeConditions(MOVIE_LISTING_TYPE.NEW_ON_DIGITAL))).toContain(
      '"movies"."digital_release_date" <= $',
    );
  });

  it('now playing relies on the TMDB now-playing flag', () => {
    expect(render(typeConditions(MOVIE_LISTING_TYPE.NOW_PLAYING))).toContain(
      '"movies"."is_now_playing" = $',
    );
  });

  it('watching now requires a release date that is not in the future', () => {
    expect(render(buildWatchingNowConditions({ now: new Date() }))).toContain(
      '"media_items"."release_date" <= $',
    );
  });
});
