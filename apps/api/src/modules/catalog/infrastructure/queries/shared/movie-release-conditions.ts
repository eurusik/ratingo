import { and, eq, exists, inArray, sql, type SQL } from 'drizzle-orm';

import { effectiveMovieReleaseDate } from '@/database/movie-release-conditions';
import * as schema from '@/database/schema';
import type { ReleaseDateRange } from '@/modules/catalog/domain/repositories/movie.repository.interface';
import { EligibilityStatus, type EvaluationContextType } from '@/modules/catalog-policy/public';

export function eligibleUnderActivePolicy(contexts: readonly EvaluationContextType[]): SQL {
  return exists(
    sql`(select 1 from ${schema.mediaCatalogEvaluations} inner join ${schema.catalogPolicies} on ${and(
      eq(schema.catalogPolicies.isActive, true),
      eq(schema.catalogPolicies.version, schema.mediaCatalogEvaluations.policyVersion),
    )} where ${and(
      eq(schema.mediaCatalogEvaluations.mediaItemId, schema.mediaItems.id),
      inArray(schema.mediaCatalogEvaluations.context, [...contexts]),
      eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
    )})`,
  );
}

export function effectiveReleaseWithin(range: ReleaseDateRange): SQL {
  const releaseDate = effectiveMovieReleaseDate();
  return sql`${releaseDate} >= ${range.from.toISOString()} and ${releaseDate} < ${range.toExclusive.toISOString()}`;
}
