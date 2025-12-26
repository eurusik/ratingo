/**
 * Run Finalization Service
 *
 * Handles finalization of evaluation runs based on completion status.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { RunAggregationService } from './run-aggregation.service';
import { RunStatus } from '../../domain/constants/evaluation.constants';

export interface FinalizeResult {
  runId: string;
  finalized: boolean;
  reason: string;
  counters?: {
    processed: number;
    total: number;
    eligible: number;
    ineligible: number;
    pending: number;
    errors: number;
  };
}

@Injectable()
export class RunFinalizeService {
  private readonly logger = new Logger(RunFinalizeService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly aggregationService: RunAggregationService,
  ) {}

  /**
   * Attempts to finalize a run if all items processed.
   *
   * @param runId - Run identifier
   * @returns Finalization result with status and counters
   */
  async finalizeRun(runId: string): Promise<FinalizeResult> {
    const runs = await this.db
      .select({
        id: schema.catalogEvaluationRuns.id,
        status: schema.catalogEvaluationRuns.status,
        totalReadySnapshot: schema.catalogEvaluationRuns.totalReadySnapshot,
      })
      .from(schema.catalogEvaluationRuns)
      .where(eq(schema.catalogEvaluationRuns.id, runId))
      .limit(1);

    if (runs.length === 0) {
      return { runId, finalized: false, reason: 'Run not found' };
    }

    const run = runs[0];

    if (run.status !== RunStatus.RUNNING) {
      return {
        runId,
        finalized: false,
        reason: `Run already in terminal state: ${run.status}`,
      };
    }

    const counters = await this.aggregationService.aggregateCounters(runId);
    const total = run.totalReadySnapshot || 0;

    // Detect anomaly: more evaluations than expected
    if (counters.processed > total) {
      this.logger.error(
        `Anomaly detected for run ${runId}: processed (${counters.processed}) > total (${total}). ` +
          `Possible causes: run_id leak, total_ready_snapshot mismatch, or duplicate evaluations.`,
      );

      try {
        await this.db
          .update(schema.catalogEvaluationRuns)
          .set({
            errorSample: sql`COALESCE(error_sample, '[]'::jsonb) || ${JSON.stringify([
              {
                type: 'ANOMALY_PROCESSED_GT_TOTAL',
                processed: counters.processed,
                total,
                timestamp: new Date().toISOString(),
              },
            ])}::jsonb`,
          })
          .where(eq(schema.catalogEvaluationRuns.id, runId));
      } catch (e) {
        this.logger.warn(`Failed to record anomaly for run ${runId}`, e);
      }
    }

    if (counters.processed < total) {
      await this.aggregationService.syncRunCounters(runId);

      return {
        runId,
        finalized: false,
        reason: `Still processing: ${counters.processed}/${total}`,
        counters: { ...counters, total },
      };
    }

    // Transition to PREPARED with WHERE guard (prevents race conditions)
    const result = await this.db
      .update(schema.catalogEvaluationRuns)
      .set({
        status: RunStatus.PREPARED,
        finishedAt: new Date(),
        processed: counters.processed,
        eligible: counters.eligible,
        ineligible: counters.ineligible,
        pending: counters.pending,
        errors: counters.errors,
      })
      .where(
        and(
          eq(schema.catalogEvaluationRuns.id, runId),
          eq(schema.catalogEvaluationRuns.status, RunStatus.RUNNING),
        ),
      )
      .returning({ id: schema.catalogEvaluationRuns.id });

    if (result.length === 0) {
      return {
        runId,
        finalized: false,
        reason: 'Run was already transitioned by another process',
        counters: { ...counters, total },
      };
    }

    this.logger.log(
      `Finalized run ${runId}: ${counters.processed}/${total} processed, ` +
        `${counters.eligible} eligible, ${counters.ineligible} ineligible, ${counters.pending} pending`,
    );

    return {
      runId,
      finalized: true,
      reason: 'Successfully finalized',
      counters: { ...counters, total },
    };
  }

  /**
   * Finds and finalizes stale running runs.
   *
   * @param maxAgeMinutes - Max age before run is considered stale
   * @returns Array of finalization results
   */
  async finalizeStaleRuns(maxAgeMinutes: number = 5): Promise<FinalizeResult[]> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    const staleRuns = await this.db
      .select({ id: schema.catalogEvaluationRuns.id })
      .from(schema.catalogEvaluationRuns)
      .where(
        and(
          eq(schema.catalogEvaluationRuns.status, RunStatus.RUNNING),
          lt(schema.catalogEvaluationRuns.startedAt, cutoff),
        ),
      );

    if (staleRuns.length === 0) {
      return [];
    }

    this.logger.log(`Found ${staleRuns.length} stale runs to check for finalization`);

    const results: FinalizeResult[] = [];
    for (const run of staleRuns) {
      const result = await this.finalizeRun(run.id);
      results.push(result);
    }

    return results;
  }
}
