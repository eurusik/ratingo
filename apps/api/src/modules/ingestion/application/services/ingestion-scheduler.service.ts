import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigType } from '@nestjs/config';
import { Queue, JobSchedulerJson } from 'bullmq';
import { INGESTION_QUEUE } from '../../ingestion.constants';
import schedulerConfig, { ScheduledJobConfig } from '../../../../config/scheduler.config';

/**
 * Manages automated ingestion jobs using BullMQ Job Schedulers.
 *
 * ## Scaling
 *
 * Set `SCHEDULER_ENABLED=false` on all but one instance to avoid race conditions.
 * Recommended: dedicated scheduler deployment or single instance with flag enabled.
 *
 * ## Job Behavior
 *
 * Uses idempotent diff-based registration:
 * - Adds only missing jobs
 * - Removes only orphaned jobs
 * - Upserts on pattern changes
 *
 * ## Environment Isolation
 *
 * Jobs namespaced by APP_ENV/NODE_ENV (e.g. "prod:scheduled-tracked-shows").
 *
 * ## Missed Jobs
 *
 * BullMQ does NOT backfill. Use manual triggers or external monitoring.
 *
 * ## Configuration
 *
 * - SCHEDULER_ENABLED: Master switch (default: true)
 * - SCHEDULER_TIMEZONE: Timezone (default: UTC)
 * - SCHEDULER_INGESTION_{JOB_NAME}_{ENABLED|PATTERN}: Per-job overrides
 */
@Injectable()
export class IngestionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(IngestionSchedulerService.name);
  private readonly envPrefix: string;

  constructor(
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
    @Inject(schedulerConfig.KEY)
    private readonly config: ConfigType<typeof schedulerConfig>,
  ) {
    this.envPrefix = process.env.APP_ENV || process.env.NODE_ENV || 'dev';
  }

  /**
   * Sets up job schedulers on module initialization.
   */
  async onModuleInit(): Promise<void> {
    await this.setupJobSchedulers();
  }

  /**
   * Gets job schedulers for current environment.
   *
   * @returns {Promise<JobSchedulerJson[]>} Schedulers filtered by env prefix
   */
  async getJobSchedulers(): Promise<JobSchedulerJson[]> {
    const allSchedulers = await this.ingestionQueue.getJobSchedulers();
    return allSchedulers.filter((s) => this.isOurScheduler(s));
  }

  /**
   * Removes all job schedulers for current environment.
   *
   * Use with caution - typically only for manual intervention.
   */
  async removeAllJobSchedulers(): Promise<void> {
    const schedulers = await this.getJobSchedulers();
    for (const scheduler of schedulers) {
      await this.ingestionQueue.removeJobScheduler(scheduler.key);
    }
    this.logger.log(`Removed ${schedulers.length} job schedulers [env=${this.envPrefix}]`);
  }

  /**
   * @deprecated Use getJobSchedulers() instead.
   */
  async getRepeatableJobs(): Promise<JobSchedulerJson[]> {
    return this.getJobSchedulers();
  }

  /**
   * @deprecated Use removeAllJobSchedulers() instead.
   */
  async removeAllRepeatableJobs(): Promise<void> {
    return this.removeAllJobSchedulers();
  }

  /**
   * Returns namespaced scheduler ID.
   *
   * @param {string} jobId - Original job ID
   * @returns {string} Namespaced ID (e.g. "prod:scheduled-tracked-shows")
   */
  private namespacedSchedulerId(jobId: string): string {
    return `${this.envPrefix}:${jobId}`;
  }

  /**
   * Checks if scheduler belongs to current environment.
   *
   * @param {JobSchedulerJson} scheduler - Scheduler to check
   * @returns {boolean} True if scheduler key starts with env prefix
   */
  private isOurScheduler(scheduler: JobSchedulerJson): boolean {
    return scheduler.key?.startsWith(`${this.envPrefix}:`) ?? false;
  }

  /**
   * Performs idempotent diff-based setup of job schedulers.
   *
   * 1. Reads current schedulers from Redis
   * 2. Computes desired state from config
   * 3. Upserts desired schedulers
   * 4. Removes orphaned schedulers
   */
  private async setupJobSchedulers(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn(
        'Scheduler DISABLED (SCHEDULER_ENABLED=false). ' +
          'No jobs will be registered or removed by this instance.',
      );
      return;
    }

    this.logger.log(`Setting up job schedulers [env=${this.envPrefix}]...`);

    try {
      const { jobs, timezone } = this.config;

      const desiredSchedulers = new Map<string, ScheduledJobConfig>();
      for (const job of jobs) {
        if (job.enabled) {
          desiredSchedulers.set(this.namespacedSchedulerId(job.jobId), job);
        }
      }

      const allExisting = await this.ingestionQueue.getJobSchedulers();
      const existingByKey = new Map<string, JobSchedulerJson>();
      for (const scheduler of allExisting) {
        if (this.isOurScheduler(scheduler)) {
          existingByKey.set(scheduler.key, scheduler);
        }
      }

      let added = 0;
      let updated = 0;
      let removed = 0;
      let unchanged = 0;

      // Remove orphaned schedulers
      for (const [existingKey] of existingByKey) {
        if (!desiredSchedulers.has(existingKey)) {
          await this.ingestionQueue.removeJobScheduler(existingKey);
          this.logger.log(`[orphan] Removed: ${existingKey}`);
          removed++;
        }
      }

      // Upsert desired schedulers
      for (const [schedulerId, jobConfig] of desiredSchedulers) {
        const existing = existingByKey.get(schedulerId);

        if (existing) {
          if (existing.pattern !== jobConfig.pattern) {
            this.logger.log(
              `[${jobConfig.name}] Pattern changed: "${existing.pattern}" → "${jobConfig.pattern}"`,
            );
            await this.upsertJobScheduler(schedulerId, jobConfig, timezone);
            updated++;
          } else {
            this.logger.debug(`[${jobConfig.name}] Unchanged: ${jobConfig.pattern}`);
            unchanged++;
          }
        } else {
          await this.upsertJobScheduler(schedulerId, jobConfig, timezone);
          this.logger.log(`[${jobConfig.name}] Added: ${jobConfig.pattern} ${timezone}`);
          added++;
        }
      }

      const disabledJobs = jobs.filter((job) => !job.enabled);
      for (const job of disabledJobs) {
        this.logger.log(`[${job.name}] DISABLED`);
      }

      this.logger.log(
        `Job schedulers sync complete: ${added} added, ${updated} updated, ` +
          `${removed} removed, ${unchanged} unchanged, ${disabledJobs.length} disabled`,
      );
    } catch (error) {
      this.logger.error(`Failed to setup job schedulers: ${String(error)}`);
    }
  }

  /**
   * Upserts a job scheduler.
   *
   * @param {string} schedulerId - Namespaced scheduler ID
   * @param {ScheduledJobConfig} job - Job configuration
   * @param {string} timezone - Timezone for cron pattern
   */
  private async upsertJobScheduler(
    schedulerId: string,
    job: ScheduledJobConfig,
    timezone: string,
  ): Promise<void> {
    await this.ingestionQueue.upsertJobScheduler(
      schedulerId,
      { pattern: job.pattern, tz: timezone },
      {
        name: job.jobType,
        data: job.data || {},
        opts: { removeOnComplete: 100, removeOnFail: 50 },
      },
    );
  }
}
