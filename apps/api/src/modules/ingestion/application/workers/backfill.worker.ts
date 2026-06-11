import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { type Job } from 'bullmq';

import { type MediaType } from '@/common/enums/media-type.enum';
import { WORKER_CONFIG } from '@/config/queue.config';

import { ResolveImportDispatcherPipeline } from '../../../user-media/public';
import { ResolveImportItemPipeline } from '../../../user-media/public';
import { BACKFILL_QUEUE, IngestionJob } from '../../ingestion.constants';
import { BackfillAltTitlesPipeline } from '../pipelines/backfill-alt-titles.pipeline';
import { BackfillImdbPipeline } from '../pipelines/backfill-imdb.pipeline';

/**
 * High-throughput worker for backfill item jobs (TMDB-only, no Trakt).
 *
 * Separated from SyncWorker so backfill jobs bypass the Trakt rate limiter.
 * Concurrency: 15 jobs in parallel — TMDB allows ~40 req/s, each job makes 1 call.
 *
 * Also handles import resolution jobs (RESOLVE_IMPORT_DISPATCHER, RESOLVE_IMPORT_ITEM)
 * which use TMDB-only endpoints and benefit from the same high-throughput configuration.
 */
@Processor(BACKFILL_QUEUE, {
  concurrency: 15,
  lockDuration: WORKER_CONFIG.backfill.lockDuration,
  limiter: WORKER_CONFIG.backfill.limiter,
})
export class BackfillWorker extends WorkerHost {
  private readonly logger = new Logger(BackfillWorker.name);

  constructor(
    private readonly backfillAltTitlesPipeline: BackfillAltTitlesPipeline,
    private readonly backfillImdbPipeline: BackfillImdbPipeline,
    private readonly resolveImportDispatcherPipeline: ResolveImportDispatcherPipeline,
    private readonly resolveImportItemPipeline: ResolveImportItemPipeline,
  ) {
    super();
  }

  async process(
    job: Job<{
      tmdbId?: number;
      type?: MediaType;
      mediaItemId?: string;
      title?: string;
      originalTitle?: string | null;
      batchId?: string;
      pendingItemId?: string;
    }>,
  ): Promise<void> {
    this.logger.debug(`[job:${job.id}] Processing ${job.name}`);
    try {
      switch (job.name) {
        case IngestionJob.BACKFILL_ALT_TITLES_ITEM:
          await this.backfillAltTitlesPipeline.processItem({
            mediaItemId: job.data.mediaItemId!,
            tmdbId: job.data.tmdbId!,
            type: job.data.type!,
            title: job.data.title!,
            originalTitle: job.data.originalTitle ?? null,
          });
          break;

        case IngestionJob.BACKFILL_IMDB_ITEM:
          await this.backfillImdbPipeline.processItem(job.data.tmdbId!, job.id ?? 'unknown');
          break;

        case IngestionJob.RESOLVE_IMPORT_DISPATCHER:
          await this.resolveImportDispatcherPipeline.execute({ batchId: job.data.batchId! });
          break;

        case IngestionJob.RESOLVE_IMPORT_ITEM:
          await this.resolveImportItemPipeline.execute({
            pendingItemId: job.data.pendingItemId!,
            batchId: job.data.batchId!,
          });
          break;

        default:
          this.logger.warn(`Unknown backfill job type: ${job.name}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`[job:${job.id}] Failed: ${err.message}`, err.stack);
      throw error;
    }
  }
}
