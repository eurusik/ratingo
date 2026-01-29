import { and, eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schema from '../../../../../database/schema';
import { type EvaluationContextType } from '../../../../catalog-policy/public';

/**
 * Checks if any evaluations exist for the given context with the active policy.
 * Used to detect degraded state when context evaluations are missing.
 *
 * @param db - Drizzle database instance
 * @param context - The evaluation context to check
 * @returns True if evaluations exist, false otherwise
 */
export async function checkContextEvaluationsExist(
  db: PostgresJsDatabase<typeof schema>,
  context: EvaluationContextType,
): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.mediaCatalogEvaluations)
    .innerJoin(
      schema.catalogPolicies,
      and(
        eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
        eq(schema.catalogPolicies.isActive, true),
      ),
    )
    .where(eq(schema.mediaCatalogEvaluations.context, context))
    .limit(1);

  return (result[0]?.count ?? 0) > 0;
}
