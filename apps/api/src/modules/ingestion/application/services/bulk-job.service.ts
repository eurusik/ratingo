import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { INGESTION_QUEUE } from '../../ingestion.constants';
import { preDedupeBulk, formatSample } from '../helpers/queue.helpers';

/** Job definition for bulk enqueue. */
export interface JobDefinition<T = any> {
  name: string;
  data: T;
  opts: { jobId: string };
}

/** Result of bulk enqueue operation. */
export interface BulkEnqueueResult {
  found: number;
  enqueued: number;
  deduped: number;
}

/**
 * Handles bulk job enqueueing with deduplication.
 *
 * Centralizes pre-deduplication, bulk adding, and progress logging
 * for all ingestion pipelines.
 */
@Injectable()
export class BulkJobService {
  private readonly CHECK_CONCURRENCY = 50;

  constructor(
    @InjectQueue(INGESTION_QUEUE)
    private readonly queue: Queue,
  ) {}

  /**
   * Enqueues jobs with deduplication and logging.
   *
   * @param jobs - Job definitions to enqueue
   * @param logger - Logger instance for progress logging
   * @param context - Context string for log messages
   * @returns Enqueue result with found/enqueued/deduped counts
   */
  async enqueueBulk<T>(
    jobs: JobDefinition<T>[],
    logger: Logger,
    context: string,
  ): Promise<BulkEnqueueResult> {
    const { jobsToAdd, deduped, sample } = await preDedupeBulk(
      jobs,
      this.queue,
      this.CHECK_CONCURRENCY,
    );

    if (jobsToAdd.length > 0) {
      await this.queue.addBulk(jobsToAdd);
    }

    logger.log(
      `${context}: found=${jobs.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${formatSample(sample)}`,
    );

    return {
      found: jobs.length,
      enqueued: jobsToAdd.length,
      deduped,
    };
  }

  /**
   * Enqueues jobs in batches with cumulative progress.
   *
   * Use for large datasets with cursor pagination.
   *
   * @param jobs - Job definitions for current batch
   * @param logger - Logger instance
   * @param context - Context string for log messages
   * @param cumulative - Running totals from previous batches
   * @returns Updated cumulative result
   */
  async enqueueBatch<T>(
    jobs: JobDefinition<T>[],
    logger: Logger,
    context: string,
    cumulative: BulkEnqueueResult = { found: 0, enqueued: 0, deduped: 0 },
  ): Promise<BulkEnqueueResult> {
    const { jobsToAdd, deduped, sample } = await preDedupeBulk(
      jobs,
      this.queue,
      this.CHECK_CONCURRENCY,
    );

    if (jobsToAdd.length > 0) {
      await this.queue.addBulk(jobsToAdd);
    }

    const result: BulkEnqueueResult = {
      found: cumulative.found + jobs.length,
      enqueued: cumulative.enqueued + jobsToAdd.length,
      deduped: cumulative.deduped + deduped,
    };

    logger.log(
      `${context} progress: found=${result.found}, enqueued=${result.enqueued}, deduped=${result.deduped}${formatSample(sample)}`,
    );

    return result;
  }

  /**
   * Adds a single delayed job.
   *
   * @param name - Job name
   * @param data - Job payload
   * @param jobId - Unique ID for deduplication
   * @param delayMs - Delay in milliseconds
   */
  async addDelayed<T>(name: string, data: T, jobId: string, delayMs: number): Promise<void> {
    await this.queue.add(name, data, { jobId, delay: delayMs });
  }
}
