/**
 * Run Aggregation Service
 *
 * Provides derived counters from evaluations table (source of truth).
 * Replaces incrementCounters approach with aggregate queries.
 *
 * Key principle: counters are NEVER incremented by jobs.
 * They are always computed from actual evaluation records.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, sql } from 'drizzle-orm';
import { EligibilityStatus } from '../../domain/constants/evaluation.constants';

export interface AggregatedCounters {
  processed: number;
  eligible: number;
  ineligible: number;
  pending: number;
  errors: number;
}

@Injectable()
export class RunAggregationService {
  private readonly logger = new Logger(RunAggregationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Aggregates counters from evaluations table for a specific run.
   * This is the source of truth - not the cached counters in catalog_evaluation_runs.
   */
  async aggregateCounters(runId: string): Promise<AggregatedCounters> {
    const result = await this.db
      .select({
        processed: sql<number>`COUNT(*)::int`,
        eligible: sql<number>`COUNT(*) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.ELIGIBLE})::int`,
        ineligible: sql<number>`COUNT(*) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.INELIGIBLE})::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.PENDING})::int`,
      })
      .from(schema.mediaCatalogEvaluations)
      .where(eq(schema.mediaCatalogEvaluations.runId, runId));

    const counters = result[0] || { processed: 0, eligible: 0, ineligible: 0, pending: 0 };

    // Get error count from run's error_sample (errors are tracked separately)
    const run = await this.db
      .select({ errorSample: schema.catalogEvaluationRuns.errorSample })
      .from(schema.catalogEvaluationRuns)
      .where(eq(schema.catalogEvaluationRuns.id, runId))
      .limit(1);

    const errorSample = (run[0]?.errorSample as any[]) || [];

    return {
      ...counters,
      errors: errorSample.length,
    };
  }

  /**
   * Syncs cached counters in catalog_evaluation_runs with actual aggregated values.
   * Call this periodically or after batch completion.
   */
  async syncRunCounters(runId: string): Promise<AggregatedCounters> {
    const counters = await this.aggregateCounters(runId);

    await this.db
      .update(schema.catalogEvaluationRuns)
      .set({
        processed: counters.processed,
        eligible: counters.eligible,
        ineligible: counters.ineligible,
        pending: counters.pending,
        errors: counters.errors,
      })
      .where(eq(schema.catalogEvaluationRuns.id, runId));

    this.logger.debug(`Synced counters for run ${runId}: ${JSON.stringify(counters)}`);

    return counters;
  }
}
