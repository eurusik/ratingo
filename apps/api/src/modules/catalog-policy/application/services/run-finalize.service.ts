/**
 * Run Finalization Service
 *
 * Handles finalization of evaluation runs based on completion status.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';

import { MS_PER_MINUTE } from '../../../../common/constants';
import {
  DEFAULT_STALE_RUN_MAX_AGE_MINUTES,
  RunStatus,
} from '../../domain/constants/evaluation.constants';
import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
} from '../../domain/repositories';
import { type FinalizeResult, type RunAnomaly } from '../../domain/types';
import { resolveRunContextScope } from '../../domain/utils/run-contexts';

import { RunAggregationService } from './run-aggregation.service';

@Injectable()
export class RunFinalizeService {
  private readonly logger = new Logger(RunFinalizeService.name);

  constructor(
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    private readonly aggregationService: RunAggregationService,
  ) {}

  /**
   * Attempts to finalize a run once every expected (item, context) evaluation is accounted for.
   *
   * An evaluation is accounted for when it either completed or permanently failed (recorded
   * in the run's error counter). Failed items therefore cannot keep a run RUNNING forever:
   * the run moves to PREPARED with `errors > 0`, and promotion is then gated by the
   * `maxErrors` / `coverageThreshold` options (see PolicyActivationService.promoteRun).
   *
   * @param runId - Run identifier
   * @returns Finalization result with status and counters
   */
  async finalizeRun(runId: string): Promise<FinalizeResult> {
    const run = await this.runRepository.findById(runId);

    if (!run) {
      return { runId, finalized: false, reason: 'Run not found' };
    }

    if (run.status !== RunStatus.RUNNING) {
      return {
        runId,
        finalized: false,
        reason: `Run already in terminal state: ${run.status}`,
      };
    }

    const scope = resolveRunContextScope(run);
    const counters = await this.aggregationService.aggregateCounters(runId, scope.requiredContexts);
    const total = run.totalReadySnapshot || 0;
    const expectedEvaluations = total * scope.contextsPerItem;

    // Detect anomaly: more evaluations than expected
    if (counters.processed > total) {
      this.logger.error(
        `Anomaly detected for run ${runId}: processed (${counters.processed}) > total (${total}). ` +
          `Possible causes: run_id leak, total_ready_snapshot mismatch, or duplicate evaluations.`,
      );

      try {
        const anomaly: RunAnomaly = {
          type: 'ANOMALY_PROCESSED_GT_TOTAL',
          processed: counters.processed,
          total,
          timestamp: new Date().toISOString(),
        };
        await this.runRepository.recordAnomaly(runId, anomaly);
      } catch (e) {
        this.logger.warn(`Failed to record anomaly for run ${runId}`, e);
      }
    }

    // Completed + permanently failed evaluations (errors are recorded once, on final attempt)
    const accountedEvaluations = counters.evaluations + counters.errors;

    if (accountedEvaluations < expectedEvaluations) {
      await this.aggregationService.syncRunCounters(runId, scope.requiredContexts);

      return {
        runId,
        finalized: false,
        reason:
          `Still processing: ${counters.processed}/${total} ` +
          `(${accountedEvaluations}/${expectedEvaluations} evaluations incl. ${counters.errors} errors)`,
        counters: { ...counters, total },
      };
    }

    if (counters.errors > 0) {
      this.logger.warn(
        `Run ${runId} finished with ${counters.errors} failed evaluations ` +
          `(${counters.processed}/${total} items fully processed); promotion requires maxErrors/coverage override`,
      );
    }

    // Transition to PREPARED with WHERE guard (prevents race conditions)
    const transitioned = await this.runRepository.transitionToPrepared(runId, counters);

    if (!transitioned) {
      return {
        runId,
        finalized: false,
        reason: 'Run was already transitioned by another process',
        counters: { ...counters, total },
      };
    }

    this.logger.log(
      `Finalized run ${runId}: ${counters.processed}/${total} processed, ` +
        `${counters.eligible} eligible, ${counters.ineligible} ineligible`,
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
  async finalizeStaleRuns(
    maxAgeMinutes: number = DEFAULT_STALE_RUN_MAX_AGE_MINUTES,
  ): Promise<FinalizeResult[]> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * MS_PER_MINUTE);

    const staleRuns = await this.runRepository.findStaleRunning(cutoff);

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
