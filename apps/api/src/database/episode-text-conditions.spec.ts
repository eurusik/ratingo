import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
  PLACEHOLDER_EPISODE_TITLE_PATTERN,
  RUSSIAN_ONLY_LETTERS,
  UKRAINIAN_LETTERS,
} from '@/modules/shared/episode-text';

import { hasUkrainianEpisodeTitle, hasUkrainianText } from './episode-text-conditions';

const render = (condition: Parameters<PgDialect['sqlToQuery']>[0]) =>
  new PgDialect().sqlToQuery(condition);

describe('hasUkrainianText', () => {
  it('builds its patterns from the same letters as pickUkrainianText', () => {
    const { params } = render(hasUkrainianText(sql`e.overview`));

    expect(params).toEqual(
      expect.arrayContaining([
        `[^${UKRAINIAN_LETTERS}]`,
        `[${RUSSIAN_ONLY_LETTERS}]`,
        '[^[:alpha:]]',
      ]),
    );
  });

  it('rejects Russian-only letters and requires at least half Ukrainian letters', () => {
    const { sql: text } = render(hasUkrainianText(sql`e.overview`));

    expect(text).toMatch(/^\(coalesce\(e\.overview, ''\) !~ \$\d+ AND /);
    expect(text).toMatch(
      /length\(regexp_replace\(coalesce\(e\.overview, ''\), \$\d+, '', 'g'\)\) > 0/,
    );
    expect(text).toMatch(/ \* 2 >= length\(regexp_replace\(/);
  });
});

describe('hasUkrainianEpisodeTitle', () => {
  it('adds the placeholder title check to the Ukrainian text check', () => {
    const { sql: text, params } = render(hasUkrainianEpisodeTitle(sql`e.title`));

    expect(text).toMatch(/ AND coalesce\(e\.title, ''\) !~ \$\d+\)$/);
    expect(params).toEqual(expect.arrayContaining([PLACEHOLDER_EPISODE_TITLE_PATTERN]));
  });
});
