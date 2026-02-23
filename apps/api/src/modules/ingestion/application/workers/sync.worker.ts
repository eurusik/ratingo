import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { type Job } from 'bullmq';

import { type MediaType } from '@/common/enums/media-type.enum';
import { WORKER_CONFIG } from '@/config/queue.config';

import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { BackfillAltTitlesPipeline } from '../pipelines/backfill-alt-titles.pipeline';
import { BackfillImdbPipeline } from '../pipelines/backfill-imdb.pipeline';
import { NewReleasesPipeline } from '../pipelines/new-releases.pipeline';
import { NowPlayingPipeline } from '../pipelines/now-playing.pipeline';
import { SnapshotsPipeline } from '../pipelines/snapshots.pipeline';
import { TrackedShowsPipeline } from '../pipelines/tracked-shows.pipeline';
import { TrendingPipeline } from '../pipelines/trending.pipeline';
import { SyncMediaService } from '../services/sync-media.service';

// Job ID formatting constants
const JOB_ID_MIN_LENGTH = 12;
const JOB_ID_SUFFIX_LENGTH = 8;

/**
 * Thin worker router: delegates all pipeline logic to specialized pipeline classes.
 * Handles job routing and error logging only.
 *
 * Concurrency: 2 jobs in parallel. Lower than before (was 5) to reduce Trakt API
 * burst pressure. With 4 HTTP calls per job, this means max 8 concurrent requests.
 * Combined with 2 req/s HTTP rate limiter, prevents 429 errors.
 */
@Processor(INGESTION_QUEUE, {
  concurrency: 2,
  lockDuration: WORKER_CONFIG.ingestion.lockDuration,
  limiter: WORKER_CONFIG.ingestion.limiter,
})
export class SyncWorker extends WorkerHost {
  private readonly logger = new Logger(SyncWorker.name);

  constructor(
    private readonly syncService: SyncMediaService,
    private readonly snapshotsPipeline: SnapshotsPipeline,
    private readonly trendingPipeline: TrendingPipeline,
    private readonly trackedShowsPipeline: TrackedShowsPipeline,
    private readonly nowPlayingPipeline: NowPlayingPipeline,
    private readonly newReleasesPipeline: NewReleasesPipeline,
    private readonly backfillImdbPipeline: BackfillImdbPipeline,
    private readonly backfillAltTitlesPipeline: BackfillAltTitlesPipeline,
  ) {
    super();
  }

  /**
   * Extracts short job ID for logging (last 8 chars or full if shorter).
   */
  private shortJobId(jobId: string | undefined): string {
    if (!jobId) return 'unknown';
    return jobId.length > JOB_ID_MIN_LENGTH ? jobId.slice(-JOB_ID_SUFFIX_LENGTH) : jobId;
  }

  /**
   * Routes jobs to appropriate pipeline handlers.
   * BullMQ handles concurrency and retries automatically.
   */
  async process(
    job: Job<
      {
        tmdbId?: number;
        tmdbIds?: number[];
        trending?: { score: number; rank: number };
        region?: string;
        daysBack?: number;
        page?: number;
        pages?: number;
        syncStats?: boolean;
        force?: boolean;
        type?: MediaType;
        since?: string;
        limit?: number;
        window?: string;
        mediaItemId?: string;
        title?: string;
        originalTitle?: string | null;
        dayId?: string;
      },
      unknown,
      string
    >,
  ): Promise<void> {
    const jid = this.shortJobId(job.id);
    this.logger.debug(`[job:${jid}] Processing ${job.name}`);
    try {
      switch (job.name) {
        // Direct sync jobs
        case IngestionJob.SYNC_MOVIE:
          await this.syncService.syncMovie(job.data.tmdbId!, job.data.trending, jid);
          break;
        case IngestionJob.SYNC_SHOW:
          await this.syncService.syncShow(job.data.tmdbId!, job.data.trending, jid);
          break;

        // Snapshots pipeline
        case IngestionJob.SYNC_SNAPSHOTS:
        case IngestionJob.SYNC_SNAPSHOTS_DISPATCHER:
          await this.snapshotsPipeline.dispatch(job.data.region);
          break;

        // Trending pipeline
        case IngestionJob.SYNC_TRENDING_DISPATCHER:
          await this.trendingPipeline.dispatch(job.data.pages, job.data.syncStats, job.data.force);
          break;
        case IngestionJob.SYNC_TRENDING_PAGE:
          await this.trendingPipeline.processPage(job.data.type!, job.data.page!, jid);
          break;
        case IngestionJob.SYNC_TRENDING_STATS:
          await this.trendingPipeline.processStats(job.data.since, job.data.limit);
          break;
        case IngestionJob.SYNC_TRENDING_FULL:
          // @deprecated - kept for backward compatibility
          await this.trendingPipeline.processFull(job.data.page, job.data.syncStats, job.data.type);
          break;

        // Tracked shows pipeline
        case IngestionJob.SYNC_TRACKED_SHOWS:
          await this.trackedShowsPipeline.dispatch(job.data.window);
          break;
        case IngestionJob.SYNC_TRACKED_SHOW_BATCH:
          await this.trackedShowsPipeline.processBatch(job.data.tmdbIds!);
          break;

        // Now playing pipeline
        case IngestionJob.SYNC_NOW_PLAYING:
          await this.nowPlayingPipeline.sync(job.data.region);
          break;
        case IngestionJob.UPDATE_NOW_PLAYING_FLAGS:
          await this.nowPlayingPipeline.updateFlags(job.data.region);
          break;

        // New releases pipeline
        case IngestionJob.SYNC_NEW_RELEASES:
          await this.newReleasesPipeline.sync(job.data.region, job.data.daysBack);
          break;

        // IMDb backfill pipeline
        case IngestionJob.BACKFILL_IMDB_DISPATCHER:
          await this.backfillImdbPipeline.dispatch();
          break;
        case IngestionJob.BACKFILL_IMDB_ITEM:
          await this.backfillImdbPipeline.processItem(job.data.tmdbId!, jid);
          break;

        // Alternative titles backfill pipeline
        case IngestionJob.BACKFILL_ALT_TITLES_DISPATCHER:
          await this.backfillAltTitlesPipeline.dispatch();
          break;
        case IngestionJob.BACKFILL_ALT_TITLES_ITEM:
          await this.backfillAltTitlesPipeline.processItem({
            mediaItemId: job.data.mediaItemId!,
            tmdbId: job.data.tmdbId!,
            type: job.data.type!,
            title: job.data.title!,
            originalTitle: job.data.originalTitle ?? null,
          });
          break;

        default:
          this.logger.warn(`[job:${jid}] Unknown job type: ${job.name}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`[job:${jid}] Failed: ${err.message}`, err.stack);
      throw error;
    }
  }
}
