import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import schedulerConfig from '../../../../config/scheduler.config';

/**
 * Scheduler service for automated ingestion jobs.
 * Uses BullMQ repeatable jobs for cron-based scheduling.
 *
 * Schedules:
 * - Tracked shows sync: twice daily (8:00 and 20:00 UTC)
 * - Daily snapshots: once daily (3:00 UTC)
 * - Trending sync: every 6 hours
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

      const { trackedShows, snapshots, trending, timezone } = this.config;

      // Tracked shows sync
      if (trackedShows.enabled) {
        await this.ingestionQueue.add(
          IngestionJob.SYNC_TRACKED_SHOWS,
          {},
          {
            repeat: {
              pattern: trackedShows.pattern,
              tz: timezone,
            },
            jobId: trackedShows.jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
        this.logger.log(`Scheduled: Tracked shows sync (${trackedShows.pattern} ${timezone})`);
      } else {
        this.logger.log('Tracked shows sync: DISABLED');
      }

      // Daily snapshots
      if (snapshots.enabled) {
        await this.ingestionQueue.add(
          IngestionJob.SYNC_SNAPSHOTS,
          {},
          {
            repeat: {
              pattern: snapshots.pattern,
              tz: timezone,
            },
            jobId: snapshots.jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
        this.logger.log(`Scheduled: Daily snapshots sync (${snapshots.pattern} ${timezone})`);
      } else {
        this.logger.log('Daily snapshots sync: DISABLED');
      }

      // Trending sync
      if (trending.enabled) {
        await this.ingestionQueue.add(
          IngestionJob.SYNC_TRENDING_FULL,
          { page: 1, syncStats: true },
          {
            repeat: {
              pattern: trending.pattern,
              tz: timezone,
            },
            jobId: trending.jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
        this.logger.log(`Scheduled: Trending sync (${trending.pattern} ${timezone})`);
      } else {
        this.logger.log('Trending sync: DISABLED');
      }

      this.logger.log('All repeatable ingestion jobs configured');
    } catch (error) {
      this.logger.error(`Failed to setup repeatable jobs: ${error.message}`);
    }
  }

  /**
   * Cleans up existing repeatable jobs with our jobIds to prevent duplicates.
   * Only removes jobs that we manage (by jobId from config).
   */
  private async cleanupExistingRepeatableJobs(): Promise<void> {
    const existingJobs = await this.ingestionQueue.getRepeatableJobs();
    const { trackedShows, snapshots, trending } = this.config;
    const ourJobIds = [trackedShows.jobId, snapshots.jobId, trending.jobId];

    let removed = 0;
    for (const job of existingJobs) {
      // Check if this is one of our managed jobs
      if (ourJobIds.some((id) => job.key.includes(id))) {
        await this.ingestionQueue.removeRepeatableByKey(job.key);
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
