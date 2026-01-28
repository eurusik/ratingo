/**
 * Catalog Policy Worker
 *
 * Thin router that delegates job processing to specialized handlers.
 * Each job type has its own handler with single responsibility.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { type Job } from 'bullmq';

import { WORKER_CONFIG } from '../../../../config/queue.config';
import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../catalog-policy.constants';

import { ReEvaluateAllHandler, EvaluateItemHandler, WatchdogHandler } from './handlers';
import type { ReEvaluateAllPayload, EvaluateCatalogItemPayload } from './types/job-payloads';

@Processor(CATALOG_POLICY_QUEUE, {
  concurrency: 1,
  lockDuration: WORKER_CONFIG.catalogPolicy.lockDuration,
})
export class CatalogPolicyWorker extends WorkerHost {
  private readonly logger = new Logger(CatalogPolicyWorker.name);

  constructor(
    private readonly reEvaluateAllHandler: ReEvaluateAllHandler,
    private readonly evaluateItemHandler: EvaluateItemHandler,
    private readonly watchdogHandler: WatchdogHandler,
  ) {
    super();
  }

  /**
   * Routes jobs to appropriate handlers.
   */
  async process(job: Job): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case CATALOG_POLICY_JOBS.RE_EVALUATE_ALL:
          await this.reEvaluateAllHandler.handle(job.data as ReEvaluateAllPayload);
          break;

        case CATALOG_POLICY_JOBS.EVALUATE_CATALOG_ITEM:
          await this.evaluateItemHandler.handle(job.data as EvaluateCatalogItemPayload);
          break;

        case CATALOG_POLICY_JOBS.WATCHDOG:
          await this.watchdogHandler.handle();
          break;

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
