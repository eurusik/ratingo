import { PgDialect } from 'drizzle-orm/pg-core';

import { FILLED_ONCE_AIRED } from '@/modules/ingestion/domain/constants/episode-details.constants';

import { episodeNeedsTmdbDetails } from './episode-details-conditions';

const render = (condition: Parameters<PgDialect['sqlToQuery']>[0]) =>
  new PgDialect().sqlToQuery(condition);

describe('episodeNeedsTmdbDetails', () => {
  const asOf = new Date('2026-11-27T12:00:00.000Z');

  it('treats a non-Ukrainian title or overview and a missing air date as gaps', () => {
    const { sql } = render(episodeNeedsTmdbDetails(asOf));

    expect(sql).toContain('NOT ((coalesce("episodes"."title"');
    expect(sql).toContain('NOT (coalesce("episodes"."overview"');
    expect(sql).toContain('"episodes"."air_date" is null');
  });

  it('counts a missing still, runtime or rating only once the episode has aired', () => {
    const { sql, params } = render(episodeNeedsTmdbDetails(asOf));

    expect(FILLED_ONCE_AIRED).toEqual(['runtime', 'stillPath', 'rating']);
    expect(sql).toMatch(
      /\("episodes"\."air_date" <= \$\d+ and \("episodes"\."runtime" is null or "episodes"\."still_path" is null or "episodes"\."vote_average" is null\)\)/,
    );
    expect(params).toContainEqual(asOf.toISOString());
  });
});
