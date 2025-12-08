import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { STATS_QUEUE, STATS_JOBS } from '../../stats.constants';
import { StatsService } from '../services/stats.service';

/**
 * Background worker for processing stats-related jobs.
 * Handles async updates of watchers count and trending metrics.
 */
@Processor(STATS_QUEUE)
export class StatsWorker extends WorkerHost {
  private readonly logger = new Logger(StatsWorker.name);

  constructor(private readonly statsService: StatsService) {
    super();
  }

  /**
   * Processes incoming jobs from the stats queue.
   *
   * @param {Job} job - BullMQ job containing type and data
   * @returns {Promise<void>}
   */
  async process(job: Job): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case STATS_JOBS.SYNC_TRENDING:
          await this.statsService.syncTrendingStats(job.data.limit || 20);
          break;

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error; // Let BullMQ handle retry
    }
  }
}
