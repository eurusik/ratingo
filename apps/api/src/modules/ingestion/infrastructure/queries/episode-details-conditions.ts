import { and, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { type PgColumn } from 'drizzle-orm/pg-core';

import { hasUkrainianEpisodeTitle, hasUkrainianText } from '@/database/episode-text-conditions';
import * as schema from '@/database/schema';
import {
  FILLED_ONCE_AIRED,
  type FilledOnceAiredField,
} from '@/modules/ingestion/domain/constants/episode-details.constants';

const FILLED_ONCE_AIRED_COLUMNS: Record<FilledOnceAiredField, PgColumn> = {
  runtime: schema.episodes.runtime,
  stillPath: schema.episodes.stillPath,
  rating: schema.episodes.voteAverage,
};

export function episodeNeedsTmdbDetails(asOf: Date): SQL {
  const missingOnceAired = FILLED_ONCE_AIRED.map((field) =>
    isNull(FILLED_ONCE_AIRED_COLUMNS[field]),
  );
  return sql`(${or(
    sql`NOT ${hasUkrainianEpisodeTitle(sql`${schema.episodes.title}`)}`,
    sql`NOT ${hasUkrainianText(sql`${schema.episodes.overview}`)}`,
    isNull(schema.episodes.airDate),
    and(lte(schema.episodes.airDate, asOf), or(...missingOnceAired)),
  )})`;
}
