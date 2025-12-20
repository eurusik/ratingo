import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { SyncMediaService } from '../services/sync-media.service';
import { SnapshotsService } from '../services/snapshots.service';
import { TrackedSyncService } from '../services/tracked-sync.service';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import {
  INGESTION_QUEUE,
  IngestionJob,
  TRACKED_SHOWS_CHUNK_SIZE,
  TMDB_REQUEST_DELAY_MS,
} from '../../ingestion.constants';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../../catalog/domain/repositories/movie.repository.interface';
import {
  IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../../../user-actions/domain/repositories/user-subscription.repository.interface';
import { SubscriptionTriggerService } from '../../../user-actions/application/subscription-trigger.service';
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
    private readonly snapshotsService: SnapshotsService,
    private readonly trackedSyncService: TrackedSyncService,
    private readonly subscriptionTriggerService: SubscriptionTriggerService,
    private readonly tmdbAdapter: TmdbAdapter,
    private readonly statsService: StatsService,
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {
    super();
  }

  /**
   * Processes a single job from the queue.
   * BullMQ handles concurrency and retries automatically.
   *
   * @param {Job<{ tmdbId?: number; trendingScore?: number; region?: string; daysBack?: number; page?: number; syncStats?: boolean; type?: MediaType }>} job - Ingestion job payload
   * @returns {Promise<void>} Nothing
   */
  async process(
    job: Job<
      {
        tmdbId?: number;
        tmdbIds?: number[];
        trending?: { score: number; rank: number }; // For trending items
        region?: string;
        daysBack?: number;
        page?: number;
        pages?: number;
        syncStats?: boolean;
        force?: boolean;
        type?: MediaType;
        since?: string;
        limit?: number;
      },
      any,
      string
    >,
  ): Promise<void> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case IngestionJob.SYNC_MOVIE:
          await this.syncService.syncMovie(job.data.tmdbId!, job.data.trending);
          break;
        case IngestionJob.SYNC_SHOW:
          await this.syncService.syncShow(job.data.tmdbId!, job.data.trending);
          break;
        case IngestionJob.SYNC_NOW_PLAYING:
          await this.processNowPlaying(job.data.region);
          break;
        case IngestionJob.SYNC_NEW_RELEASES:
          await this.processNewReleases(job.data.region, job.data.daysBack);
          break;
        case IngestionJob.SYNC_TRENDING_DISPATCHER:
          await this.processTrendingDispatcher(job.data.pages, job.data.syncStats, job.data.force);
          break;
        case IngestionJob.SYNC_TRENDING_PAGE:
          await this.processTrendingPage(job.data.type, job.data.page);
          break;
        case IngestionJob.SYNC_TRENDING_STATS:
          await this.processTrendingStats(job.data.since, job.data.limit);
          break;
        case IngestionJob.SYNC_TRENDING_FULL:
          // @deprecated - kept for backward compatibility
          await this.processTrendingFull(job.data.page, job.data.syncStats, job.data.type);
          break;
        case IngestionJob.UPDATE_NOW_PLAYING_FLAGS:
          await this.updateNowPlayingFlags(job.data.region);
          break;
        case IngestionJob.SYNC_SNAPSHOTS:
          await this.snapshotsService.syncDailySnapshots();
          break;
        case IngestionJob.SYNC_TRACKED_SHOWS:
          await this.processTrackedShowsDispatcher();
          break;
        case IngestionJob.SYNC_TRACKED_SHOW_BATCH:
          await this.processTrackedShowBatch(job.data.tmdbIds!);
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
    this.logger.log(
      `Starting full trending sync (page: ${page}, syncStats: ${syncStats}, type: ${type || 'all'})...`,
    );

    // Get trending items from TMDB
    const items = await this.syncService.getTrending(page, type);
    this.logger.log(`Found ${items.length} trending items`);

    // Sync each item sequentially
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rank = (page - 1) * 20 + i + 1;
      const score = 10000 - rank + 1;
      const trending = { score, rank };

      try {
        if (item.type === MediaType.MOVIE) {
          await this.syncService.syncMovie(item.tmdbId, trending);
        } else {
          await this.syncService.syncShow(item.tmdbId, trending);
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
   * Trending dispatcher: queues page jobs for movies and shows.
   * Each page job syncs 20 items from TMDB trending.
   * Stats job is queued separately with delay to ensure page jobs complete first.
   *
   * Dedupe strategy:
   * - Page jobs: hour-based window (YYYYMMDDHH) - 1 run per hour
   * - Item jobs: day-based (type_tmdbId_YYYYMMDD) - 1 sync per day
   * - force=true: bypasses PAGE dedupe only; item dedupe always applies
   */
  private async processTrendingDispatcher(
    pages = 5,
    syncStats = true,
    force = false,
  ): Promise<void> {
    const dispatcherStartedAt = new Date();
    // Page-level dedupe: hour-based window (allows 1 run per hour per type/page)
    // Format: YYYYMMDDHH (no colons - BullMQ doesn't allow them in jobId)
    // force=true → bypass page dedupe (item dedupe still applies)
    const window = force
      ? dispatcherStartedAt.getTime().toString()
      : dispatcherStartedAt.toISOString().slice(0, 13).replace(/[-T]/g, '');
    this.logger.log(
      `Starting trending dispatcher (pages: ${pages}, syncStats: ${syncStats}, force: ${force})...`,
    );

    const types: MediaType[] = [MediaType.MOVIE, MediaType.SHOW];
    const jobs: { name: string; data: any; opts?: { jobId: string } }[] = [];

    for (const type of types) {
      for (let page = 1; page <= pages; page++) {
        jobs.push({
          name: IngestionJob.SYNC_TRENDING_PAGE,
          data: { type, page },
          opts: { jobId: `trending_${type}_${page}_${window}` },
        });
      }
    }

    await this.ingestionQueue.addBulk(jobs);

    // Queue stats job with delay to ensure page jobs complete first
    // Stats job will query items by trendingUpdatedAt >= since
    if (syncStats) {
      const expectedLimit = pages * 20 * 2; // pages × 20 items × 2 types
      await this.ingestionQueue.add(
        IngestionJob.SYNC_TRENDING_STATS,
        {
          since: dispatcherStartedAt.toISOString(),
          limit: expectedLimit,
        },
        {
          jobId: `trending-stats_${window}`,
          delay: 3 * 60 * 1000, // 3 minutes delay
        },
      );
      this.logger.log(`Queued trending stats job (delay: 3min, limit: ${expectedLimit})`);
    }

    this.logger.log(
      `Trending dispatcher complete: ${jobs.length} page jobs queued (${pages} pages × 2 types)`,
    );
  }

  /**
   * Syncs Trakt stats for recently updated trending items.
   * Queries items by trendingUpdatedAt >= since.
   */
  private async processTrendingStats(since?: string, limit?: number): Promise<void> {
    const sinceDate = since ? new Date(since) : undefined;
    this.logger.log(
      `Syncing Trakt stats for trending items (since: ${sinceDate?.toISOString() || 'all'}, limit: ${limit || 'default'})...`,
    );

    const result = await this.statsService.syncTrendingStatsForUpdatedItems({
      since: sinceDate,
      limit: limit || 200,
    });

    this.logger.log(`Trending stats sync complete: ${result.movies} movies, ${result.shows} shows`);
  }

  /**
   * Trending page job: fetches trending list and enqueues individual sync jobs.
   * Does NOT sync items inline - delegates to SYNC_MOVIE/SYNC_SHOW jobs.
   * This keeps the job short and prevents lock expiry issues.
   *
   * Uses jobId dedupe: same item won't be synced twice in the same day (UTC).
   * Note: force flag on dispatcher bypasses page dedupe, but item dedupe always applies.
   */
  private async processTrendingPage(type: MediaType, page: number): Promise<void> {
    this.logger.log(`Processing trending page: ${type} page ${page}...`);

    const items = await this.syncService.getTrending(page, type);

    if (items.length === 0) {
      this.logger.log(`Trending page ${type} page ${page}: found=0`);
      return;
    }

    // Day key in UTC for consistent dedupe across timezones
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD UTC

    // Track enqueued vs deduped with sample IDs
    let enqueued = 0;
    let deduped = 0;
    const enqueuedIds: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rank = (page - 1) * 20 + i + 1; // 1-indexed position in TMDB trending
      const score = 10000 - rank + 1; // Higher score = higher rank
      const trending = { score, rank };

      const jobId = `${item.type}_${item.tmdbId}_${today}`;
      const jobName =
        item.type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW;

      // Check if job already exists (item dedupe - always applies)
      const existingJob = await this.ingestionQueue.getJob(jobId);
      if (existingJob) {
        deduped++;
        continue;
      }

      // Enqueue new job
      await this.ingestionQueue.add(jobName, { tmdbId: item.tmdbId, trending }, { jobId });
      enqueued++;
      if (enqueuedIds.length < 5) enqueuedIds.push(item.tmdbId); // Sample up to 5 IDs
    }

    // Single summary log line
    const sampleIds = enqueuedIds.length > 0 ? `, sample=[${enqueuedIds.join(',')}]` : '';
    this.logger.log(
      `Trending page ${type} page ${page}: found=${items.length}, enqueued=${enqueued}, deduped=${deduped}${sampleIds}`,
    );
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
    const jobs = tmdbIds.map((tmdbId) => ({
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
    const jobs = tmdbIds.map((tmdbId) => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
    }));
    await this.ingestionQueue.addBulk(jobs);

    this.logger.log(`New releases sync complete: ${tmdbIds.length} movies queued`);
  }

  /**
   * Dispatcher job: fetches tracked show IDs and queues batch jobs.
   * Chunks the IDs to avoid memory issues with large addBulk calls.
   */
  private async processTrackedShowsDispatcher(): Promise<void> {
    this.logger.log('Starting tracked shows sync dispatcher...');

    // Get all tracked show TMDB IDs
    const tmdbIds = await this.subscriptionRepository.findTrackedShowTmdbIds();
    this.logger.log(`Found ${tmdbIds.length} tracked shows to sync`);

    if (tmdbIds.length === 0) return;

    // Chunk into batches and queue batch jobs
    const chunks: number[][] = [];
    for (let i = 0; i < tmdbIds.length; i += TRACKED_SHOWS_CHUNK_SIZE) {
      chunks.push(tmdbIds.slice(i, i + TRACKED_SHOWS_CHUNK_SIZE));
    }

    // Queue batch jobs in smaller addBulk calls to avoid memory issues
    const BULK_LIMIT = 10;
    for (let i = 0; i < chunks.length; i += BULK_LIMIT) {
      const batchChunks = chunks.slice(i, i + BULK_LIMIT);
      const jobs = batchChunks.map((chunkTmdbIds) => ({
        name: IngestionJob.SYNC_TRACKED_SHOW_BATCH,
        data: { tmdbIds: chunkTmdbIds },
      }));
      await this.ingestionQueue.addBulk(jobs);
    }

    this.logger.log(
      `Tracked shows dispatcher complete: ${chunks.length} batch jobs queued for ${tmdbIds.length} shows`,
    );
  }

  /**
   * Batch job: syncs a chunk of tracked shows with diff detection.
   * Processes shows sequentially with rate limiting to respect TMDB limits.
   */
  private async processTrackedShowBatch(tmdbIds: number[]): Promise<void> {
    this.logger.log(`Processing tracked show batch: ${tmdbIds.length} shows`);

    let processed = 0;
    let withChanges = 0;

    for (const tmdbId of tmdbIds) {
      try {
        const diff = await this.trackedSyncService.syncShowWithDiff(tmdbId);

        if (diff.hasChanges) {
          withChanges++;
          // Process diff and generate notification events
          const events = await this.subscriptionTriggerService.handleShowDiff(diff);
          if (events.length > 0) {
            this.logger.log(`Show ${tmdbId}: ${events.length} notifications generated`);
          }
        }

        processed++;

        // Rate limiting: delay between TMDB API calls
        if (processed < tmdbIds.length) {
          await this.delay(TMDB_REQUEST_DELAY_MS);
        }
      } catch (error) {
        this.logger.error(`Failed to sync tracked show ${tmdbId}: ${error.message}`);
        // Continue with next show
      }
    }

    this.logger.log(
      `Tracked show batch complete: ${processed}/${tmdbIds.length} processed, ${withChanges} with changes`,
    );
  }

  /**
   * Simple delay helper for rate limiting.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
