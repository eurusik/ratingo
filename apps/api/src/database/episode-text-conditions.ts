import { sql, type SQL } from 'drizzle-orm';

import {
  PLACEHOLDER_EPISODE_TITLE_PATTERN,
  RUSSIAN_ONLY_LETTERS,
  UKRAINIAN_LETTERS,
} from '@/modules/shared/episode-text';

const NON_UKRAINIAN_LETTER = `[^${UKRAINIAN_LETTERS}]`;
const RUSSIAN_ONLY_LETTER = `[${RUSSIAN_ONLY_LETTERS}]`;
const NON_LETTER = '[^[:alpha:]]';

export function hasUkrainianText(text: SQL): SQL {
  const value = sql`coalesce(${text}, '')`;
  const ukrainian = sql`length(regexp_replace(${value}, ${NON_UKRAINIAN_LETTER}, '', 'g'))`;
  const letters = sql`length(regexp_replace(${value}, ${NON_LETTER}, '', 'g'))`;
  const notRussian = sql`${value} !~ ${RUSSIAN_ONLY_LETTER}`;
  const mostlyUkrainian = sql`${ukrainian} > 0 AND ${ukrainian} * 2 >= ${letters}`;
  return sql`(${notRussian} AND ${mostlyUkrainian})`;
}

export function hasUkrainianEpisodeTitle(title: SQL): SQL {
  return sql`(${hasUkrainianText(title)} AND coalesce(${title}, '') !~ ${PLACEHOLDER_EPISODE_TITLE_PATTERN})`;
}
