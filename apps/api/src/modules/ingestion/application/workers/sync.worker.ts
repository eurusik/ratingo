import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SyncMediaService } from '../services/sync-media.service';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';

/**
 * Background worker responsible for processing sync jobs from the Queue.
 * Handles 'sync-movie' and 'sync-show' jobs.
 */
@Processor(INGESTION_QUEUE)
export class SyncWorker extends WorkerHost {
  private readonly logger = new Logger(SyncWorker.name);

  constructor(private readonly syncService: SyncMediaService) {
    super();
  }

  /**
   * Processes a single job from the queue.
   * BullMQ handles concurrency and retries automatically.
   */
  async process(job: Job<{ tmdbId: number }, any, string>): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case IngestionJob.SYNC_MOVIE:
          await this.syncService.syncMovie(job.data.tmdbId);
          break;
        case IngestionJob.SYNC_SHOW:
          await this.syncService.syncShow(job.data.tmdbId);
          break;
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error; // Re-throw to let BullMQ handle retry logic
    }
  }
}
