import { sql, type SQL } from 'drizzle-orm';

import {
  PLACEHOLDER_EPISODE_TITLE_PATTERN,
  UKRAINIAN_LETTERS,
} from '@/modules/shared/episode-text';

const NON_UKRAINIAN_LETTER = `[^${UKRAINIAN_LETTERS}]`;
const NON_LETTER = '[^[:alpha:]]';

export function hasUkrainianText(text: SQL): SQL {
  const ukrainian = sql`length(regexp_replace(coalesce(${text}, ''), ${NON_UKRAINIAN_LETTER}, '', 'g'))`;
  const letters = sql`length(regexp_replace(coalesce(${text}, ''), ${NON_LETTER}, '', 'g'))`;
  return sql`(${ukrainian} > 0 AND ${ukrainian} * 2 >= ${letters})`;
}

export function hasUkrainianEpisodeTitle(title: SQL): SQL {
  return sql`(${hasUkrainianText(title)} AND coalesce(${title}, '') !~ ${PLACEHOLDER_EPISODE_TITLE_PATTERN})`;
}
