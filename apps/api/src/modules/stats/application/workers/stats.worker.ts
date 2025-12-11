import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { STATS_QUEUE, STATS_JOBS } from '../../stats.constants';
import { StatsService } from '../services/stats.service';
import { DropOffService } from '../services/drop-off.service';

/**
 * Background worker for processing stats-related jobs.
 * Handles async updates of watchers count, trending metrics, and drop-off analysis.
 *
 * Concurrency: 1 (jobs are already batched internally)
 */
@Processor(STATS_QUEUE, { concurrency: 1 })
export class StatsWorker extends WorkerHost {
  private readonly logger = new Logger(StatsWorker.name);

  constructor(
    private readonly statsService: StatsService,
    private readonly dropOffService: DropOffService
  ) {
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

        case STATS_JOBS.ANALYZE_DROP_OFF:
          if (job.data.tmdbId) {
            // Analyze single show
            await this.dropOffService.analyzeShow(job.data.tmdbId);
          } else {
            // Analyze all shows
            await this.dropOffService.analyzeAllShows(job.data.limit || 50);
          }
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
