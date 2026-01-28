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
   * Attempts to finalize a run if all items processed.
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

    const counters = await this.aggregationService.aggregateCounters(runId);
    const total = run.totalReadySnapshot || 0;

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
