import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { SyncMediaService } from '../services/sync-media.service';
import { TmdbAdapter } from '../../infrastructure/adapters/tmdb/tmdb.adapter';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { IMovieRepository, MOVIE_REPOSITORY } from '../../../catalog/domain/repositories/movie.repository.interface';
import { StatsService } from '../../../stats/application/services/stats.service';
import { MediaType } from '../../../../common/enums/media-type.enum';

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
    private readonly statsService: StatsService,
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
  async process(job: Job<{ tmdbId?: number; trendingScore?: number; region?: string; daysBack?: number; page?: number; syncStats?: boolean; type?: MediaType }, any, string>): Promise<void> {
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
        case IngestionJob.SYNC_TRENDING_FULL:
          await this.processTrendingFull(job.data.page, job.data.syncStats, job.data.type);
          break;
        case IngestionJob.UPDATE_NOW_PLAYING_FLAGS:
          await this.updateNowPlayingFlags(job.data.region);
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
   * Full trending sync: ingestion + stats.
   * 1. Fetch trending items from TMDB
   * 2. Sync each movie/show (sequential to avoid rate limits)
   * 3. Update Trakt stats if syncStats=true
   */
  private async processTrendingFull(page = 1, syncStats = true, type?: MediaType): Promise<void> {
    this.logger.log(`Starting full trending sync (page: ${page}, syncStats: ${syncStats}, type: ${type || 'all'})...`);

    // Get trending items from TMDB
    const items = await this.syncService.getTrending(page, type);
    this.logger.log(`Found ${items.length} trending items`);

    // Sync each item sequentially
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const trendingScore = 10000 - ((page - 1) * 20 + i);
      
      try {
        if (item.type === MediaType.MOVIE) {
          await this.syncService.syncMovie(item.tmdbId, trendingScore);
        } else {
          await this.syncService.syncShow(item.tmdbId, trendingScore);
        }
      } catch (error) {
        this.logger.error(`Failed to sync ${item.type} ${item.tmdbId}: ${error.message}`);
        // Continue with next item
      }
    }

    // Sync Trakt stats if requested
    if (syncStats) {
      this.logger.log('Syncing Trakt stats...');
      await this.statsService.syncTrendingStats();
    }

    this.logger.log(`Full trending sync complete: ${items.length} items processed`);
  }

  /**
   * Syncs now playing movies from TMDB (ingestion only).
   * Does NOT update isNowPlaying flags - use UPDATE_NOW_PLAYING_FLAGS for that.
   */
  private async processNowPlaying(region = 'UA'): Promise<void> {
    this.logger.log(`Syncing now playing movies (region: ${region})...`);

    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    this.logger.log(`Found ${tmdbIds.length} now playing movies`);

    if (tmdbIds.length === 0) return;

    // Queue sync jobs for each movie
    const jobs = tmdbIds.map(tmdbId => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
    }));
    await this.ingestionQueue.addBulk(jobs);

    this.logger.log(`Now playing ingestion complete: ${tmdbIds.length} movies queued`);
  }

  /**
   * Updates isNowPlaying flags based on current TMDB now_playing list.
   * - Sets isNowPlaying = true for movies in the list that exist in DB
   * - Sets isNowPlaying = false for movies no longer in the list
   * 
   * Should be run AFTER SYNC_NOW_PLAYING has completed (e.g., 5-10 min later).
   */
  private async updateNowPlayingFlags(region = 'UA'): Promise<void> {
    this.logger.log(`Updating now playing flags (region: ${region})...`);

    // Fetch fresh now_playing list from TMDB
    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    this.logger.log(`Found ${tmdbIds.length} now playing movies in TMDB`);

    // Update flags in DB (sets true for those in list, false for others)
    await this.movieRepository.setNowPlaying(tmdbIds);

    this.logger.log(`Now playing flags updated for ${tmdbIds.length} movies`);
  }

  /**
   * Syncs new theatrical releases from TMDB.
   * Uses discover endpoint with release date filters.
   */
  private async processNewReleases(region = 'UA', daysBack = 30): Promise<void> {
    this.logger.log(`Syncing new releases (region: ${region}, daysBack: ${daysBack})...`);

    // Get IDs from TMDB discover
    const tmdbIds = await this.tmdbAdapter.getNewReleaseIds(daysBack, region);
    this.logger.log(`Found ${tmdbIds.length} new releases`);

    if (tmdbIds.length === 0) return;

    // Queue sync jobs for each movie
    const jobs = tmdbIds.map(tmdbId => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
    }));
    await this.ingestionQueue.addBulk(jobs);

    this.logger.log(`New releases sync complete: ${tmdbIds.length} movies queued`);
  }
}
