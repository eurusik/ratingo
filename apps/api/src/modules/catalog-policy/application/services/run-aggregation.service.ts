/**
 * Run Aggregation Service
 *
 * Provides derived counters from evaluations table (source of truth).
 *
 * Note: Per Readability & Pending Reform, PENDING is no longer returned by Policy Engine.
 * The pending counter is always 0 for policy runs. PENDING status only exists in
 * ingestion layer (ingestion_status field) as "not ready for evaluation".
 */

import { Injectable, Logger, Inject } from '@nestjs/common';

import { eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus } from '../../domain/constants/evaluation.constants';

export interface AggregatedCounters {
  processed: number;
  eligible: number;
  ineligible: number;
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
   *
   * Note: Per Readability & Pending Reform, pending is always 0.
   * @param runId - Run identifier
   * @returns Aggregated counters
   */
  async aggregateCounters(runId: string): Promise<AggregatedCounters> {
    // Use COUNT(DISTINCT media_item_id) for processed to avoid double-counting
    // when multiple contexts evaluate the same media item
    const result = await this.db
      .select({
        processed: sql<number>`COUNT(DISTINCT ${schema.mediaCatalogEvaluations.mediaItemId})::int`,
        eligible: sql<number>`COUNT(DISTINCT ${schema.mediaCatalogEvaluations.mediaItemId}) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.ELIGIBLE})::int`,
        ineligible: sql<number>`COUNT(DISTINCT ${schema.mediaCatalogEvaluations.mediaItemId}) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.INELIGIBLE})::int`,
      })
      .from(schema.mediaCatalogEvaluations)
      .where(eq(schema.mediaCatalogEvaluations.runId, runId));

    const counters = result[0] || { processed: 0, eligible: 0, ineligible: 0 };

    // Get error count from run's error_sample (errors are tracked separately)
    const run = await this.db
      .select({ errorSample: schema.catalogEvaluationRuns.errorSample })
      .from(schema.catalogEvaluationRuns)
      .where(eq(schema.catalogEvaluationRuns.id, runId))
      .limit(1);

    const errorSample = (run[0]?.errorSample as unknown[]) || [];

    return {
      ...counters,
      errors: errorSample.length,
    };
  }

  /**
   * Syncs cached counters with actual aggregated values.
   *
   * @param runId - Run identifier
   * @returns Synced counters
   */
  async syncRunCounters(runId: string): Promise<AggregatedCounters> {
    const counters = await this.aggregateCounters(runId);

    await this.db
      .update(schema.catalogEvaluationRuns)
      .set({
        processed: counters.processed,
        eligible: counters.eligible,
        ineligible: counters.ineligible,
        errors: counters.errors,
      })
      .where(eq(schema.catalogEvaluationRuns.id, runId));

    this.logger.debug(`Synced counters for run ${runId}: ${JSON.stringify(counters)}`);

    return counters;
  }
}
