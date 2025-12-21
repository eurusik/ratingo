import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SyncMediaService } from '../services/sync-media.service';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '@/common/enums/media-type.enum';
import { SnapshotsPipeline } from '../pipelines/snapshots.pipeline';
import { TrendingPipeline } from '../pipelines/trending.pipeline';
import { TrackedShowsPipeline } from '../pipelines/tracked-shows.pipeline';
import { NowPlayingPipeline } from '../pipelines/now-playing.pipeline';
import { NewReleasesPipeline } from '../pipelines/new-releases.pipeline';

/**
 * Thin worker router: delegates all pipeline logic to specialized pipeline classes.
 * Handles job routing and error logging only.
 *
 * Concurrency: 5 jobs processed in parallel for faster throughput.
 */
@Processor(INGESTION_QUEUE, { concurrency: 5 })
export class SyncWorker extends WorkerHost {
  private readonly logger = new Logger(SyncWorker.name);

  constructor(
    private readonly syncService: SyncMediaService,
    private readonly snapshotsPipeline: SnapshotsPipeline,
    private readonly trendingPipeline: TrendingPipeline,
    private readonly trackedShowsPipeline: TrackedShowsPipeline,
    private readonly nowPlayingPipeline: NowPlayingPipeline,
    private readonly newReleasesPipeline: NewReleasesPipeline,
  ) {
    super();
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
        dayId?: string;
      },
      any,
      string
    >,
  ): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);
    try {
      switch (job.name) {
        // Direct sync jobs
        case IngestionJob.SYNC_MOVIE:
          await this.syncService.syncMovie(job.data.tmdbId!, job.data.trending);
          break;
        case IngestionJob.SYNC_SHOW:
          await this.syncService.syncShow(job.data.tmdbId!, job.data.trending);
          break;

        // Snapshots pipeline
        case IngestionJob.SYNC_SNAPSHOTS:
        case IngestionJob.SYNC_SNAPSHOTS_DISPATCHER:
          await this.snapshotsPipeline.dispatch(job.data.region);
          break;
        case IngestionJob.SYNC_SNAPSHOT_ITEM:
          await this.snapshotsPipeline.processItem(
            job.data.mediaItemId!,
            job.data.dayId!,
            job.data.region!,
          );
          break;

        // Trending pipeline
        case IngestionJob.SYNC_TRENDING_DISPATCHER:
          await this.trendingPipeline.dispatch(job.data.pages, job.data.syncStats, job.data.force);
          break;
        case IngestionJob.SYNC_TRENDING_PAGE:
          await this.trendingPipeline.processPage(job.data.type!, job.data.page!);
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

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
