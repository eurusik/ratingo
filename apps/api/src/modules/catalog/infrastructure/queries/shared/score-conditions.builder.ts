import { gte, sql, type SQL } from 'drizzle-orm';

import * as schema from '@/database/schema';
import type { ScoreFilterOptions } from '@/modules/catalog/domain/types/query.types';

export function buildMovieScoreConditions({ minRatingo, minQuality }: ScoreFilterOptions): SQL[] {
  const conditions: SQL[] = [];
  if (minRatingo !== undefined) conditions.push(gte(schema.mediaStats.ratingoScore, minRatingo));
  if (minQuality !== undefined) conditions.push(gte(schema.mediaStats.qualityScore, minQuality));
  return conditions;
}

export function buildShowScoreConditions({ minRatingo, minQuality }: ScoreFilterOptions): SQL[] {
  const conditions: SQL[] = [];
  if (minRatingo !== undefined) conditions.push(sql`ms.ratingo_score >= ${minRatingo}`);
  if (minQuality !== undefined) conditions.push(sql`ms.quality_score >= ${minQuality}`);
  return conditions;
}
