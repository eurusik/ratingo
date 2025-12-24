/**
 * Catalog Policy Worker
 *
 * Background worker for processing catalog policy evaluation jobs.
 * Handles RE_EVALUATE_ALL (batch orchestration) and EVALUATE_CATALOG_ITEM (single item evaluation).
 *
 * Concurrency: 1 for RE_EVALUATE_ALL (orchestrator), 10 for EVALUATE_CATALOG_ITEM (parallel processing)
 */

import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
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
import { RunStatus, EligibilityStatus } from '../../domain/constants/evaluation.constants';

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
export class CatalogPolicyWorker extends WorkerHost {
  private readonly logger = new Logger(CatalogPolicyWorker.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    private readonly evaluationService: CatalogEvaluationService,
    @InjectQueue(CATALOG_POLICY_QUEUE)
    private readonly catalogQueue: Queue,
  ) {
    super();
  }

  /**
   * Processes incoming jobs from the catalog policy queue.
   */
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

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error; // Let BullMQ handle retry
    }
  }

  /**
   * RE_EVALUATE_ALL job handler
   * Orchestrates batch evaluation using a while loop to process all items.
   * More stable than self-dispatch chain for large catalogs.
   */
  private async handleReEvaluateAll(payload: ReEvaluateAllPayload): Promise<void> {
    const { runId, policyVersion, batchSize = 500 } = payload;

    this.logger.log(`Starting RE_EVALUATE_ALL for run ${runId}, policy v${policyVersion}`);

    // 1. Fetch run to get snapshotCutoff
    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    // 2. Check if run was cancelled
    if (run.status === RunStatus.CANCELLED) {
      this.logger.log(`Run ${runId} was cancelled, stopping`);
      return;
    }

    let cursor: string | undefined = payload.cursor;
    let totalDispatched = 0;

    // 3. Process batches in while loop until all items processed
    while (true) {
      // Check if run was cancelled before each batch
      const currentRun = await this.runRepository.findById(runId);
      if (!currentRun || currentRun.status === RunStatus.CANCELLED) {
        this.logger.log(`Run ${runId} was cancelled during processing, stopping`);
        return;
      }

      // Fetch batch of media items
      const batch = await this.fetchBatch(run.snapshotCutoff!, batchSize, cursor);

      if (batch.length === 0) {
        // All items processed - mark run as SUCCESS
        await this.runRepository.update(runId, {
          status: RunStatus.SUCCESS,
          finishedAt: new Date(),
        });

        this.logger.log(
          `Run ${runId} completed successfully. Total dispatched: ${totalDispatched} jobs`,
        );
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
          jobId: `eval:${policyVersion}:${item.id}`, // Idempotent job ID
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
   * Evaluates a single media item and updates run counters atomically.
   */
  private async handleEvaluateCatalogItem(payload: EvaluateCatalogItemPayload): Promise<void> {
    const { runId, policyVersion, mediaItemId } = payload;

    // Check if run was cancelled before processing
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
      // Evaluate item
      const result = await this.evaluationService.evaluateOne(mediaItemId, policyVersion);

      // Atomically increment counters (prevents race conditions)
      const increments: any = { processed: 1 };

      // Note: evaluationService returns uppercase status, constants are lowercase
      const statusLower = result.evaluation.status.toLowerCase();
      if (statusLower === EligibilityStatus.ELIGIBLE) {
        increments.eligible = 1;
      } else if (statusLower === EligibilityStatus.INELIGIBLE) {
        increments.ineligible = 1;
      } else if (statusLower === EligibilityStatus.PENDING) {
        increments.pending = 1;
      }

      await this.runRepository.incrementCounters(runId, increments);

      this.logger.debug(`Evaluated ${mediaItemId}: ${result.evaluation.status}`);
    } catch (error) {
      this.logger.error(`Failed to evaluate ${mediaItemId}`, error);

      // Atomically record error (increments counter + appends to sample in one UPDATE)
      await this.runRepository.recordError(runId, {
        mediaItemId,
        error: error.message,
        stack: error.stack?.substring(0, 500),
        timestamp: new Date().toISOString(),
      });

      // Don't throw - we want to continue processing other items
    }
  }

  /**
   * Fetches a batch of media items for evaluation.
   * Filters by snapshotCutoff and uses cursor for pagination.
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
}
