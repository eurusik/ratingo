/**
 * Re-Evaluate All Handler
 *
 * Orchestrates batch evaluation for a policy run.
 * Fetches items in batches and dispatches individual evaluation jobs.
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';

import { type Queue } from 'bullmq';
import { eq, and, isNull, lte, gt } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import * as schema from '../../../../../database/schema';
import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../../catalog-policy.constants';
import {
  RunStatus,
  type EvaluationContextType,
} from '../../../domain/constants/evaluation.constants';
import { RunNotFoundError } from '../../../domain/errors';
import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
} from '../../../domain/repositories';
import { RunFinalizeService } from '../../services/run-finalize.service';
import type { ReEvaluateAllPayload, EvaluateCatalogItemPayload } from '../types/job-payloads';
import { validateContextPayload } from '../utils/context-validator';

const DEFAULT_BATCH_SIZE = 500;

@Injectable()
export class ReEvaluateAllHandler {
  private readonly logger = new Logger(ReEvaluateAllHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
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
    const { runId, policyVersion, context, batchSize = DEFAULT_BATCH_SIZE } = payload;

    if (!validateContextPayload(payload, { runId, policyVersion }, this.logger)) {
      return;
    }

    this.logger.log(
      `Starting RE_EVALUATE_ALL for run=${runId}, policy=v${policyVersion}, context=${context}`,
    );

    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    if (run.status === RunStatus.CANCELLED) {
      this.logger.log(`Run ${runId} was cancelled, stopping`);
      return;
    }

    let { cursor } = payload;
    let totalDispatched = 0;

    while (true) {
      const currentRun = await this.runRepository.findById(runId);
      if (!currentRun || currentRun.status === RunStatus.CANCELLED) {
        this.logger.log(`Run ${runId} was cancelled during processing, stopping`);
        return;
      }

      const batch = await this.fetchBatch(run.snapshotCutoff!, batchSize, cursor);

      if (batch.length === 0) {
        await this.attemptFinalization(runId, totalDispatched, context);
        return;
      }

      this.logger.log(
        `Fetched batch of ${batch.length} items for run=${runId}, context=${context}`,
      );

      const jobs = batch.map((item) => ({
        name: CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM,
        data: {
          runId,
          policyVersion,
          mediaItemId: item.id,
          context,
        } as EvaluateCatalogItemPayload,
        opts: {
          jobId: `eval_${runId}_${item.id}_${context}`,
        },
      }));

      await this.catalogQueue.addBulk(jobs);
      totalDispatched += batch.length;

      cursor = batch[batch.length - 1].id;
      await this.runRepository.update(runId, { cursor });

      this.logger.debug(
        `Dispatched ${batch.length} evaluation jobs for run=${runId}, context=${context} (total: ${totalDispatched})`,
      );
    }
  }

  /**
   * Fetches batch of media items for evaluation.
   */
  private async fetchBatch(
    snapshotCutoff: Date,
    batchSize: number,
    cursor?: string,
  ): Promise<Array<{ id: string }>> {
    const conditions = [
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
      lte(schema.mediaItems.updatedAt, snapshotCutoff),
    ];

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    return this.db
      .select({ id: schema.mediaItems.id })
      .from(schema.mediaItems)
      .where(and(...conditions))
      .orderBy(schema.mediaItems.id)
      .limit(batchSize);
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
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(
        `Finalize attempt failed for run ${runId}, watchdog will retry: ${err.message}`,
      );
    }
  }
}
