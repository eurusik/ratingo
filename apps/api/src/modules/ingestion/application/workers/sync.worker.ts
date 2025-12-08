import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { SyncMediaService } from '../services/sync-media.service';
import { TmdbAdapter } from '../../infrastructure/adapters/tmdb/tmdb.adapter';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { IMovieRepository, MOVIE_REPOSITORY } from '@/modules/catalog/domain/repositories/movie.repository.interface';

/**
 * Background worker responsible for processing sync jobs from the Queue.
 * Handles movie/show sync and now playing/new releases batch jobs.
 * 
 * Concurrency: 5 jobs processed in parallel for faster throughput.
 */
@Processor(INGESTION_QUEUE, { concurrency: 5 })
export class SyncWorker extends WorkerHost {
  private readonly logger = new Logger(SyncWorker.name);

  constructor(
    private readonly syncService: SyncMediaService,
    private readonly tmdbAdapter: TmdbAdapter,
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {
    super();
  }

  /**
   * Processes a single job from the queue.
   * BullMQ handles concurrency and retries automatically.
   */
  async process(job: Job<{ tmdbId?: number; trendingScore?: number; region?: string; daysBack?: number }, any, string>): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case IngestionJob.SYNC_MOVIE:
          await this.syncService.syncMovie(job.data.tmdbId!, job.data.trendingScore);
          break;
        case IngestionJob.SYNC_SHOW:
          await this.syncService.syncShow(job.data.tmdbId!, job.data.trendingScore);
          break;
        case IngestionJob.SYNC_NOW_PLAYING:
          await this.processNowPlaying(job.data.region);
          break;
        case IngestionJob.SYNC_NEW_RELEASES:
          await this.processNewReleases(job.data.region, job.data.daysBack);
          break;
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Syncs now playing movies from TMDB.
   * 1. Fetch IDs from TMDB /movie/now_playing
   * 2. Queue sync jobs for each movie
   * 3. Update isNowPlaying flags in DB
   */
  private async processNowPlaying(region = 'UA'): Promise<void> {
    this.logger.log(`Syncing now playing movies (region: ${region})...`);

    // 1. Get IDs from TMDB
    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    this.logger.log(`Found ${tmdbIds.length} now playing movies`);

    if (tmdbIds.length === 0) return;

    // 2. Queue sync jobs for each movie (they may not exist in our DB yet)
    const jobs = tmdbIds.map(tmdbId => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
    }));
    await this.ingestionQueue.addBulk(jobs);

    // 3. Update isNowPlaying flags (after a delay to let syncs complete)
    // For now, we update immediately with existing movies
    await this.movieRepository.setNowPlaying(tmdbIds);

    this.logger.log(`Now playing sync complete: ${tmdbIds.length} movies queued`);
  }

  /**
   * Syncs new theatrical releases from TMDB.
   * Uses discover endpoint with release date filters.
   */
  private async processNewReleases(region = 'UA', daysBack = 30): Promise<void> {
    this.logger.log(`Syncing new releases (region: ${region}, daysBack: ${daysBack})...`);

    // 1. Get IDs from TMDB discover
    const tmdbIds = await this.tmdbAdapter.getNewReleaseIds(daysBack, region);
    this.logger.log(`Found ${tmdbIds.length} new releases`);

    if (tmdbIds.length === 0) return;

    // 2. Queue sync jobs for each movie
    const jobs = tmdbIds.map(tmdbId => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
    }));
    await this.ingestionQueue.addBulk(jobs);

    this.logger.log(`New releases sync complete: ${tmdbIds.length} movies queued`);
  }
}
