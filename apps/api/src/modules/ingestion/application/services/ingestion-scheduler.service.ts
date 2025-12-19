import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { INGESTION_QUEUE } from '../../ingestion.constants';
import schedulerConfig, { ScheduledJobConfig } from '../../../../config/scheduler.config';

/**
 * Scheduler service for automated ingestion jobs.
 * Uses BullMQ repeatable jobs for cron-based scheduling.
 *
 * All jobs are configured via scheduler.config.ts with env overrides.
 * Format: SCHEDULER_INGESTION_{JOB_NAME}_{ENABLED|PATTERN}
 */
@Injectable()
export class IngestionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(IngestionSchedulerService.name);

  constructor(
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
    @Inject(schedulerConfig.KEY)
    private readonly config: ConfigType<typeof schedulerConfig>,
  ) {}

  /**
   * Sets up repeatable jobs on module initialization.
   */
  async onModuleInit(): Promise<void> {
    await this.setupRepeatableJobs();
  }

  /**
   * Configures all repeatable jobs from config.
   * Uses BullMQ's built-in repeat functionality.
   * Removes existing jobs first to prevent duplicates on restart.
   */
  private async setupRepeatableJobs(): Promise<void> {
    this.logger.log('Setting up repeatable ingestion jobs...');

    try {
      // Remove existing repeatable jobs to prevent duplicates
      await this.cleanupExistingRepeatableJobs();

      const { jobs, timezone } = this.config;
      let scheduled = 0;
      let skipped = 0;

      for (const job of jobs) {
        if (!job.enabled) {
          this.logger.log(`[${job.name}] DISABLED`);
          skipped++;
          continue;
        }

        await this.ingestionQueue.add(job.jobType, job.data || {}, {
          repeat: {
            pattern: job.pattern,
            tz: timezone,
          },
          jobId: job.jobId,
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        this.logger.log(`[${job.name}] Scheduled: ${job.pattern} ${timezone}`);
        scheduled++;
      }

      this.logger.log(`Repeatable jobs configured: ${scheduled} scheduled, ${skipped} disabled`);
    } catch (error) {
      this.logger.error(`Failed to setup repeatable jobs: ${error.message}`);
    }
  }

  /**
   * Cleans up existing repeatable jobs with our jobIds to prevent duplicates.
   * Logs pattern changes for debugging.
   * Only removes jobs that we manage (by jobId from config).
   */
  private async cleanupExistingRepeatableJobs(): Promise<void> {
    const existingJobs = await this.ingestionQueue.getRepeatableJobs();
    const configJobsMap = new Map(this.config.jobs.map((j) => [j.jobId, j]));

    let removed = 0;
    for (const existingJob of existingJobs) {
      // Find matching config job by jobId
      const configJob = Array.from(configJobsMap.values()).find((cj) =>
        existingJob.key.includes(cj.jobId),
      );

      if (configJob) {
        // Log if pattern changed
        if (existingJob.pattern !== configJob.pattern) {
          this.logger.warn(
            `[${configJob.name}] Pattern changed: "${existingJob.pattern}" → "${configJob.pattern}"`,
          );
        }

        await this.ingestionQueue.removeRepeatableByKey(existingJob.key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.log(`Cleaned up ${removed} existing repeatable jobs`);
    }
  }

  /**
   * Gets list of all repeatable jobs for monitoring.
   */
  async getRepeatableJobs(): Promise<any[]> {
    return this.ingestionQueue.getRepeatableJobs();
  }

  /**
   * Removes all repeatable jobs (for cleanup/reset).
   */
  async removeAllRepeatableJobs(): Promise<void> {
    const jobs = await this.ingestionQueue.getRepeatableJobs();
    for (const job of jobs) {
      await this.ingestionQueue.removeRepeatableByKey(job.key);
    }
    this.logger.log(`Removed ${jobs.length} repeatable jobs`);
  }
}
