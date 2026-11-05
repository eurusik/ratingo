/**
 * Re-Evaluate All Handler
 *
 * Orchestrates batch evaluation for a policy run.
 * Fetches items in batches and dispatches individual evaluation jobs.
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { toError } from '@/common/utils/error.utils';

import {
  CATALOG_POLICY_QUEUE,
  CATALOG_POLICY_JOBS,
  EVALUATE_ITEM_JOB_OPTIONS,
} from '../../../catalog-policy.constants';
import {
  RunStatus,
  type EvaluationContextType,
} from '../../../domain/constants/evaluation.constants';
import { RunNotFoundError } from '../../../domain/errors';
import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  POLICY_INPUT_REPOSITORY,
  type ICatalogEvaluationRunRepository,
  type IPolicyInputRepository,
  type UpdatedAtWindow,
} from '../../../domain/repositories';
import { RunFinalizeService } from '../../services/run-finalize.service';
import type { ReEvaluateAllPayload, EvaluateCatalogItemPayload } from '../types/job-payloads';
import { validateContextPayload } from '../utils/context-validator';

const DEFAULT_BATCH_SIZE = 500;

@Injectable()
export class ReEvaluateAllHandler {
  private readonly logger = new Logger(ReEvaluateAllHandler.name);

  constructor(
    @Inject(POLICY_INPUT_REPOSITORY)
    private readonly policyInputRepository: IPolicyInputRepository,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    private readonly finalizeService: RunFinalizeService,
    @InjectQueue(CATALOG_POLICY_QUEUE)
    private readonly catalogQueue: Queue,
  ) {}

  /**
   * Handles RE_EVALUATE_ALL job.
   * Fetches items in batches and dispatches EVALUATE_CATALOG_ITEM jobs.
   */
  async handle(payload: ReEvaluateAllPayload): Promise<void> {
    const {
      runId,
      policyVersion,
      context,
      batchSize = DEFAULT_BATCH_SIZE,
      afterSnapshot = false,
    } = payload;

    if (!validateContextPayload(payload, { runId, policyVersion }, this.logger)) {
      return;
    }

    this.logger.log(
      `Starting RE_EVALUATE_ALL for run=${runId}, policy=v${policyVersion}, context=${context}${
        afterSnapshot ? ' (items updated after snapshot)' : ''
      }`,
    );

    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    if (run.status === RunStatus.CANCELLED) {
      this.logger.log(`Run ${runId} was cancelled, stopping`);
      return;
    }

    const updatedAtWindow = this.toUpdatedAtWindow(run.snapshotCutoff, afterSnapshot);
    if (!updatedAtWindow) {
      this.logger.warn(`Run ${runId} has no snapshotCutoff, no items will be dispatched`);
    }

    let { cursor } = payload;
    let totalDispatched = 0;

    while (true) {
      const currentRun = await this.runRepository.findById(runId);
      if (!currentRun || currentRun.status === RunStatus.CANCELLED) {
        this.logger.log(`Run ${runId} was cancelled during processing, stopping`);
        return;
      }

      const batch = updatedAtWindow
        ? await this.policyInputRepository.fetchBatchIds({ batchSize, cursor, updatedAtWindow })
        : [];

      if (batch.length === 0) {
        if (afterSnapshot) {
          // Run is already terminal (promoted): nothing to finalize
          this.logger.log(
            `Dispatched ${totalDispatched} post-snapshot jobs for run=${runId}, context=${context}`,
          );
          return;
        }
        await this.attemptFinalization(runId, totalDispatched, context);
        return;
      }

      this.logger.log(
        `Fetched batch of ${batch.length} items for run=${runId}, context=${context}`,
      );

      const jobs = batch.map((mediaItemId) => ({
        name: CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM,
        data: {
          runId,
          policyVersion,
          mediaItemId,
          context,
        } as EvaluateCatalogItemPayload,
        opts: {
          jobId: `${afterSnapshot ? 'eval_post' : 'eval'}_${runId}_${mediaItemId}_${context}`,
          ...EVALUATE_ITEM_JOB_OPTIONS,
        },
      }));

      await this.catalogQueue.addBulk(jobs);
      totalDispatched += batch.length;

      cursor = batch[batch.length - 1];
      if (!afterSnapshot) {
        await this.runRepository.update(runId, { cursor });
      }

      this.logger.debug(
        `Dispatched ${batch.length} evaluation jobs for run=${runId}, context=${context} (total: ${totalDispatched})`,
      );
    }
  }

  private toUpdatedAtWindow(
    snapshotCutoff: Date | null,
    afterSnapshot: boolean,
  ): UpdatedAtWindow | null {
    if (!snapshotCutoff) return null;
    return afterSnapshot ? { updatedAfter: snapshotCutoff } : { updatedAtOrBefore: snapshotCutoff };
  }

  /**
   * Attempts to finalize a run after all jobs are dispatched.
   */
  private async attemptFinalization(
    runId: string,
    totalDispatched: number,
    context: EvaluationContextType,
  ): Promise<void> {
    this.logger.log(
      `All ${totalDispatched} jobs dispatched for run=${runId}, context=${context}, attempting finalize...`,
    );

    try {
      const result = await this.finalizeService.finalizeRun(runId);
      if (result.finalized) {
        this.logger.log(
          `Run ${runId} finalized: ${result.counters?.processed}/${result.counters?.total}`,
        );
      } else {
        this.logger.log(`Run ${runId} not ready for finalization: ${result.reason}`);
      }
    } catch (error: unknown) {
      const err = toError(error);
      this.logger.warn(
        `Finalize attempt failed for run ${runId}, watchdog will retry: ${err.message}`,
      );
    }
  }
}
