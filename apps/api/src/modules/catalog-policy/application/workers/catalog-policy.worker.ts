/**
 * Background worker for catalog policy evaluation jobs.
 *
 * Handles RE_EVALUATE_ALL (batch orchestration), EVALUATE_CATALOG_ITEM (single item),
 * and WATCHDOG (stale run finalization).
 *
 * Counters are derived from evaluations table, not incremented per job.
 * Concurrency: 1 for orchestrator, 10 for item evaluation.
 */

import { Processor, WorkerHost, InjectQueue, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, isNull, lte, gt } from 'drizzle-orm';
import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../catalog-policy.constants';
import {
  ICatalogEvaluationRunRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
} from '../../infrastructure/repositories/catalog-evaluation-run.repository';
import { CatalogEvaluationService } from '../services/catalog-evaluation.service';
import { RunFinalizeService } from '../services/run-finalize.service';
import { RunStatus } from '../../domain/constants/evaluation.constants';

interface ReEvaluateAllPayload {
  runId: string;
  policyVersion: number;
  batchSize?: number;
  cursor?: string;
}

interface EvaluateCatalogItemPayload {
  runId: string;
  policyVersion: number;
  mediaItemId: string;
}

@Processor(CATALOG_POLICY_QUEUE, { concurrency: 1 })
export class CatalogPolicyWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(CatalogPolicyWorker.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    private readonly evaluationService: CatalogEvaluationService,
    private readonly finalizeService: RunFinalizeService,
    @InjectQueue(CATALOG_POLICY_QUEUE)
    private readonly catalogQueue: Queue,
  ) {
    super();
  }

  /**
   * Schedules watchdog job on module init.
   *
   * Uses Redis SETNX for distributed lock to prevent race conditions
   * when multiple instances start simultaneously.
   */
  async onModuleInit() {
    const lockKey = 'catalog-policy:watchdog:register-lock';
    const lockTtl = 10000;

    try {
      const client = await this.catalogQueue.client;
      const acquired = await client.set(lockKey, process.pid.toString(), 'PX', lockTtl, 'NX');

      if (!acquired) {
        this.logger.debug('Another instance is registering watchdog, skipping');
        return;
      }

      const existingJobs = await this.catalogQueue.getRepeatableJobs();
      for (const job of existingJobs) {
        if (job.name === CATALOG_POLICY_JOBS.WATCHDOG) {
          await this.catalogQueue.removeRepeatableByKey(job.key);
          this.logger.debug(`Removed existing watchdog job: ${job.key}`);
        }
      }

      await this.catalogQueue.add(
        CATALOG_POLICY_JOBS.WATCHDOG,
        {},
        {
          repeat: {
            every: 60000,
          },
          jobId: 'catalog-policy-watchdog',
        },
      );

      this.logger.log('Watchdog job scheduled (every 60s)');
    } catch (error) {
      this.logger.error('Failed to schedule watchdog job', error);
    }
  }

  /** Routes jobs to appropriate handlers. */
  async process(job: Job): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case CATALOG_POLICY_JOBS.RE_EVALUATE_ALL:
          await this.handleReEvaluateAll(job.data as ReEvaluateAllPayload);
          break;

        case CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM:
          await this.handleEvaluateCatalogItem(job.data as EvaluateCatalogItemPayload);
          break;

        case CATALOG_POLICY_JOBS.WATCHDOG:
          await this.handleWatchdog();
          break;

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Orchestrates batch evaluation for a run.
   *
   * Dispatches EVALUATE_CATALOG_ITEM jobs for all items in snapshot.
   * Watchdog finalizes if orchestrator fails after dispatch.
   */
  private async handleReEvaluateAll(payload: ReEvaluateAllPayload): Promise<void> {
    const { runId, policyVersion, batchSize = 500 } = payload;

    this.logger.log(`Starting RE_EVALUATE_ALL for run ${runId}, policy v${policyVersion}`);

    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (run.status === RunStatus.CANCELLED) {
      this.logger.log(`Run ${runId} was cancelled, stopping`);
      return;
    }

    let cursor: string | undefined = payload.cursor;
    let totalDispatched = 0;

    while (true) {
      const currentRun = await this.runRepository.findById(runId);
      if (!currentRun || currentRun.status === RunStatus.CANCELLED) {
        this.logger.log(`Run ${runId} was cancelled during processing, stopping`);
        return;
      }

      const batch = await this.fetchBatch(run.snapshotCutoff!, batchSize, cursor);

      if (batch.length === 0) {
        // All items dispatched - attempt to finalize
        // Note: finalize may not complete if jobs are still processing
        // Watchdog will handle finalization if needed
        this.logger.log(
          `All ${totalDispatched} jobs dispatched for run ${runId}, attempting finalize...`,
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
        } catch (error) {
          // Finalize failure is not critical - watchdog will retry
          this.logger.warn(
            `Finalize attempt failed for run ${runId}, watchdog will retry: ${error.message}`,
          );
        }

        return;
      }

      this.logger.log(`Fetched batch of ${batch.length} items for run ${runId}`);

      // Dispatch EVALUATE_CATALOG_ITEM jobs for each item in batch
      const jobs = batch.map((item) => ({
        name: CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM,
        data: {
          runId,
          policyVersion,
          mediaItemId: item.id,
        } as EvaluateCatalogItemPayload,
        opts: {
          jobId: `eval:${runId}:${item.id}`, // Idempotent job ID per run
        },
      }));

      await this.catalogQueue.addBulk(jobs);
      totalDispatched += batch.length;

      // Update cursor to last item in batch
      cursor = batch[batch.length - 1].id;
      await this.runRepository.update(runId, {
        cursor,
      });

      this.logger.debug(`Dispatched ${batch.length} evaluation jobs (total: ${totalDispatched})`);
    }
  }

  /**
   * EVALUATE_CATALOG_ITEM job handler
   * Evaluates a single media item and writes evaluation with run_id.
   *
   * Architecture (v2):
   * - Writes evaluation with run_id (idempotent via UNIQUE constraint)
   * - Does NOT increment counters (counters are derived from evaluations)
   * - Errors are recorded in run's error_sample
   */
  /**
   * Evaluates single media item and writes result with run_id.
   *
   * Skips if run cancelled. Records errors in run's error_sample.
   * Does not throw - continues processing other items on failure.
   */
  private async handleEvaluateCatalogItem(payload: EvaluateCatalogItemPayload): Promise<void> {
    const { runId, policyVersion, mediaItemId } = payload;

    const run = await this.runRepository.findById(runId);
    if (!run) {
      this.logger.warn(`Run ${runId} not found, skipping item ${mediaItemId}`);
      return;
    }

    if (run.status === RunStatus.CANCELLED) {
      this.logger.debug(`Run ${runId} cancelled, skipping item ${mediaItemId}`);
      return;
    }

    try {
      await this.evaluationService.evaluateOne(mediaItemId, policyVersion, runId);
      this.logger.debug(`Evaluated ${mediaItemId} for run ${runId}`);
    } catch (error) {
      this.logger.error(`Failed to evaluate ${mediaItemId}`, error);

      await this.runRepository.recordError(runId, {
        mediaItemId,
        error: error.message,
        stack: error.stack?.substring(0, 500),
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Fetches batch of media items for evaluation.
   *
   * @param snapshotCutoff - Only items updated before this date
   * @param batchSize - Max items to fetch
   * @param cursor - Last item ID for pagination
   */
  private async fetchBatch(
    snapshotCutoff: Date,
    batchSize: number,
    cursor?: string,
  ): Promise<Array<{ id: string }>> {
    const conditions = [
      eq(schema.mediaItems.ingestionStatus, 'ready'),
      isNull(schema.mediaItems.deletedAt),
      lte(schema.mediaItems.updatedAt, snapshotCutoff),
    ];

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    const result = await this.db
      .select({ id: schema.mediaItems.id })
      .from(schema.mediaItems)
      .where(and(...conditions))
      .orderBy(schema.mediaItems.id)
      .limit(batchSize);

    return result;
  }

  /**
   * Checks for stale runs and finalizes them.
   *
   * Safety net ensuring runs complete even if orchestrator fails.
   * Runs every minute via scheduled job.
   */
  private async handleWatchdog(): Promise<void> {
    this.logger.debug('Watchdog checking for stale runs...');

    try {
      const results = await this.finalizeService.finalizeStaleRuns(5);

      if (results.length > 0) {
        const finalized = results.filter((r) => r.finalized);
        const pending = results.filter((r) => !r.finalized);

        if (finalized.length > 0) {
          this.logger.log(`Watchdog finalized ${finalized.length} runs`);
        }

        if (pending.length > 0) {
          this.logger.debug(
            `Watchdog found ${pending.length} runs still processing: ${pending.map((r) => r.reason).join(', ')}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Watchdog error:', error);
    }
  }
}
