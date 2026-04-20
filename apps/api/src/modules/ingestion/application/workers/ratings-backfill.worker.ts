import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { type Job } from 'bullmq';

import { MediaType } from '@/common/enums/media-type.enum';
import { WORKER_CONFIG } from '@/config/queue.config';

import { IngestionJob, RATINGS_BACKFILL_QUEUE } from '../../ingestion.constants';
import { BackfillMdblistRatingsPipeline } from '../pipelines/backfill-mdblist-ratings.pipeline';

interface MdblistItemPayload {
  mediaItemId: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Runtime guard against malformed BullMQ payloads. TypeScript types do not
 * survive JSON serialisation, so a renamed field or a manual re-queue via
 * BullMQ UI could otherwise reach the pipeline and trigger non-null
 * assertion crashes or pathological URL construction.
 */
function isValidMdblistItemPayload(data: unknown): data is MdblistItemPayload {
  if (!data || typeof data !== 'object') return false;
  const { mediaItemId, tmdbId, type } = data as Record<string, unknown>;
  return (
    typeof mediaItemId === 'string' &&
    mediaItemId.length > 0 &&
    Number.isInteger(tmdbId) &&
    (tmdbId as number) > 0 &&
    (type === MediaType.MOVIE || type === MediaType.SHOW)
  );
}

/**
 * Dedicated worker for external-ratings backfill jobs.
 *
 * Separated from BackfillWorker because MDBList's free tier allows only
 * ~1000 requests/day. Sharing the TMDB-tuned 600/min limiter would drain
 * the daily budget in under two minutes.
 *
 * Concurrency=1 because every job consumes a scarce quota unit; adding
 * parallelism only accelerates quota exhaustion without speeding the drain.
 */
@Processor(RATINGS_BACKFILL_QUEUE, {
  concurrency: 1,
  lockDuration: WORKER_CONFIG.ratingsBackfill.lockDuration,
  limiter: WORKER_CONFIG.ratingsBackfill.limiter,
})
export class RatingsBackfillWorker extends WorkerHost {
  private readonly logger = new Logger(RatingsBackfillWorker.name);

  constructor(private readonly mdblistRatingsPipeline: BackfillMdblistRatingsPipeline) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    this.logger.debug(`[job:${job.id}] Processing ${job.name}`);
    try {
      switch (job.name) {
        case IngestionJob.BACKFILL_MDBLIST_RATINGS_ITEM:
          if (!isValidMdblistItemPayload(job.data)) {
            // Log & swallow. Throwing would retry the job 3× with the same
            // bad payload — pure noise, no recovery path.
            this.logger.warn(
              `[job:${job.id}] Dropping malformed MDBList payload: ${JSON.stringify(job.data)}`,
            );
            return;
          }
          await this.mdblistRatingsPipeline.processItem(job.data);
          break;

        default:
          this.logger.warn(`Unknown ratings-backfill job type: ${job.name}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`[job:${job.id}] Failed: ${err.message}`, err.stack);
      throw error;
    }
  }
}
