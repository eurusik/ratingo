/**
 * Watchdog Handler
 *
 * Periodically checks for and finalizes stale evaluation runs.
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../../catalog-policy.constants';
import { RunFinalizeService } from '../../services/run-finalize.service';

const STALE_RUN_MAX_AGE_MINUTES = 1;
const WATCHDOG_INTERVAL_MS = 60000;
const WATCHDOG_LOCK_TTL_MS = 10000;

@Injectable()
export class WatchdogHandler implements OnModuleInit {
  private readonly logger = new Logger(WatchdogHandler.name);

  constructor(
    private readonly finalizeService: RunFinalizeService,
    @InjectQueue(CATALOG_POLICY_QUEUE)
    private readonly catalogQueue: Queue,
  ) {}

  /**
   * Schedules watchdog job on module init.
   *
   * Uses Redis SETNX for distributed lock to prevent race conditions
   * when multiple instances start simultaneously.
   */
  async onModuleInit(): Promise<void> {
    const lockKey = 'catalog-policy:watchdog:register-lock';

    try {
      const client = await this.catalogQueue.client;
      const acquired = await client.set(
        lockKey,
        process.pid.toString(),
        'PX',
        WATCHDOG_LOCK_TTL_MS,
        'NX',
      );

      if (!acquired) {
        this.logger.debug('Another instance is registering watchdog, skipping');
        return;
      }

      await this.removeExistingWatchdogJobs();
      await this.scheduleWatchdogJob();

      this.logger.log('Watchdog job scheduled (every 60s)');
    } catch (error) {
      this.logger.error('Failed to schedule watchdog job', error);
    }
  }

  /**
   * Handles WATCHDOG job.
   * Checks for stale runs and finalizes them.
   */
  async handle(): Promise<void> {
    this.logger.debug('Watchdog checking for stale runs...');

    try {
      const results = await this.finalizeService.finalizeStaleRuns(STALE_RUN_MAX_AGE_MINUTES);
      this.logResults(results);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Watchdog error during stale run finalization', {
        errorMessage: err.message,
        errorName: err.name,
      });
      this.logger.debug('Watchdog error stack:', err.stack);
    }
  }

  /**
   * Removes existing watchdog jobs before scheduling new one.
   */
  private async removeExistingWatchdogJobs(): Promise<void> {
    const existingJobs = await this.catalogQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      if (job.name === CATALOG_POLICY_JOBS.WATCHDOG) {
        await this.catalogQueue.removeRepeatableByKey(job.key);
        this.logger.debug(`Removed existing watchdog job: ${job.key}`);
      }
    }
  }

  /**
   * Schedules repeatable watchdog job.
   */
  private async scheduleWatchdogJob(): Promise<void> {
    await this.catalogQueue.add(
      CATALOG_POLICY_JOBS.WATCHDOG,
      {},
      {
        repeat: { every: WATCHDOG_INTERVAL_MS },
        jobId: 'catalog-policy-watchdog',
      },
    );
  }

  /**
   * Logs watchdog finalization results.
   */
  private logResults(results: Array<{ finalized: boolean; reason?: string }>): void {
    if (results.length === 0) return;

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
}
