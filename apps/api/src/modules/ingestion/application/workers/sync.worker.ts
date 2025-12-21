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
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
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

import { formatUtcDayId, utcDateFromDayId } from '@/common/utils/date.util';

/**
 * Background worker responsible for processing sync jobs from the Queue.
 * Handles movie/show sync and now playing/new releases batch jobs.
 *
 * Concurrency: 5 jobs processed in parallel for faster throughput.
 */
@Processor(INGESTION_QUEUE, { concurrency: 5 })
export class SyncWorker extends WorkerHost {
  private readonly logger = new Logger(SyncWorker.name);
  private readonly CHECK_CONCURRENCY = 50; // Limit parallel Redis checks

  private normalizeSnapshotRegion(region?: string): string {
    if (!region) return 'global';
    if (region.toLowerCase() === 'global') return 'global';
    const sanitized = region.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    return sanitized.length > 0 ? sanitized : 'global';
  }

  constructor(
    private readonly syncService: SyncMediaService,
    private readonly snapshotsService: SnapshotsService,
    private readonly trackedSyncService: TrackedSyncService,
    private readonly subscriptionTriggerService: SubscriptionTriggerService,
    private readonly tmdbAdapter: TmdbAdapter,
    private readonly statsService: StatsService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
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
        case IngestionJob.UPDATE_NOW_PLAYING_FLAGS:
          await this.updateNowPlayingFlags(job.data.region);
          break;
        case IngestionJob.SYNC_SNAPSHOTS:
        case IngestionJob.SYNC_SNAPSHOTS_DISPATCHER:
          await this.processSnapshotsDispatcher(job.data.region);
          break;
        case IngestionJob.SYNC_SNAPSHOT_ITEM:
          await this.processSnapshotItem(job.data.mediaItemId, job.data.dayId, job.data.region);
          break;
        case IngestionJob.SYNC_TRENDING_DISPATCHER:
          await this.processTrendingDispatcher(job.data.pages, job.data.syncStats, job.data.force);
          break;
        case IngestionJob.SYNC_TRENDING_PAGE:
          await this.processTrendingPage(job.data.type!, job.data.page!);
          break;
        case IngestionJob.SYNC_TRENDING_STATS:
          await this.processTrendingStats(job.data.since, job.data.limit);
          break;
        case IngestionJob.SYNC_TRENDING_FULL:
          // @deprecated - kept for backward compatibility
          await this.processTrendingFull(job.data.page, job.data.syncStats, job.data.type);
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
   * Snapshot Dispatcher:
   * 1. Iterates over ALL media items using cursor pagination.
   * 2. Checks if snapshot job already exists for today (dedupe).
   * 3. Enqueues SYNC_SNAPSHOT_ITEM jobs in batches.
   */
  private async processSnapshotsDispatcher(region = 'global'): Promise<void> {
    const normalizedRegion = this.normalizeSnapshotRegion(region);
    const today = formatUtcDayId();
    const BATCH_SIZE = 500; // Database page size
    let cursor: string | undefined;

    let found = 0;
    let enqueued = 0;
    let deduped = 0;

    this.logger.log(
      `Starting snapshots dispatcher (region: ${normalizedRegion}, date: ${today})...`,
    );

    // Loop until no more items
    while (true) {
      const ids = await this.mediaRepository.findIdsForSnapshots({
        limit: BATCH_SIZE,
        cursor,
      });

      if (ids.length === 0) break;

      found += ids.length;
      cursor = ids[ids.length - 1]; // Update cursor for next page

      // Prepare batch of jobs
      const jobsToAdd: any[] = [];
      const enqueuedIds: string[] = [];

      // Chunk for parallel Redis checks (dedupe)
      for (let i = 0; i < ids.length; i += this.CHECK_CONCURRENCY) {
        const chunk = ids.slice(i, i + this.CHECK_CONCURRENCY);

        const chunkChecks = await Promise.all(
          chunk.map(async (mediaItemId) => {
            const jobId = `snapshot_${mediaItemId}_${today}_${normalizedRegion}`;
            const existing = await this.ingestionQueue.getJob(jobId);
            return { mediaItemId, existing, jobId };
          }),
        );

        for (const { mediaItemId, existing, jobId } of chunkChecks) {
          if (existing) {
            deduped++;
            continue;
          }

          jobsToAdd.push({
            name: IngestionJob.SYNC_SNAPSHOT_ITEM,
            data: { mediaItemId, region: normalizedRegion, dayId: today },
            opts: { jobId },
          });
          enqueuedIds.push(mediaItemId);
        }
      }

      // Add to queue
      if (jobsToAdd.length > 0) {
        await this.ingestionQueue.addBulk(jobsToAdd);
        enqueued += jobsToAdd.length;
      }

      const sampleIds =
        enqueuedIds.length > 0 ? `, sample=[${enqueuedIds.slice(0, 3).join(',')}]` : '';
      this.logger.log(
        `Snapshots dispatcher progress: found=${found}, enqueued=${enqueued}, deduped=${deduped}${sampleIds}`,
      );
    }

    this.logger.log(
      `Snapshots dispatcher complete: found=${found}, enqueued=${enqueued}, deduped=${deduped}`,
    );
  }

  /**
   * Syncs a single snapshot item.
   * Wrapper around service call.
   */
  private async processSnapshotItem(
    mediaItemId: string,
    dayId: string,
    region: string,
  ): Promise<void> {
    const normalizedRegion = this.normalizeSnapshotRegion(region);
    let snapshotDate: Date;
    try {
      snapshotDate = utcDateFromDayId(dayId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown dayId parsing error';
      throw new Error(
        `Invalid snapshot dayId payload (mediaItemId=${mediaItemId}, region=${normalizedRegion}, dayId=${dayId}): ${message}`,
      );
    }
    await this.snapshotsService.syncSnapshotItem(mediaItemId, snapshotDate, normalizedRegion);
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
    const today = formatUtcDayId();

    let deduped = 0;
    const jobsToAdd: any[] = [];
    const enqueuedIds: number[] = [];

    // Chunk for parallel checks to avoid Redis pressure
    for (let i = 0; i < items.length; i += this.CHECK_CONCURRENCY) {
      const chunk = items.slice(i, i + this.CHECK_CONCURRENCY);
      const chunkChecks = await Promise.all(
        chunk.map(async (item, chunkIndex) => {
          const originalIndex = i + chunkIndex;
          const jobId = `${item.type}_${item.tmdbId}_${today}`;
          const existing = await this.ingestionQueue.getJob(jobId);
          return { item, i: originalIndex, existing, jobId };
        }),
      );

      for (const { item, i, existing, jobId } of chunkChecks) {
        if (existing) {
          deduped++;
          continue;
        }

        const rank = (page - 1) * 20 + i + 1; // 1-indexed position in TMDB trending
        const score = 10000 - rank + 1; // Higher score = higher rank
        const trending = { score, rank };
        const jobName =
          item.type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW;

        jobsToAdd.push({
          name: jobName,
          data: { tmdbId: item.tmdbId, trending },
          opts: { jobId },
        });
        enqueuedIds.push(item.tmdbId);
      }
    }

    if (jobsToAdd.length > 0) {
      await this.ingestionQueue.addBulk(jobsToAdd);
    }

    // Single summary log line
    const sampleIds =
      enqueuedIds.length > 0 ? `, sample=[${enqueuedIds.slice(0, 5).join(',')}]` : '';
    this.logger.log(
      `Trending page ${type} page ${page}: found=${items.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${sampleIds}`,
    );
  }

  /**
   * Syncs now playing movies from TMDB (ingestion only).
   * Does NOT update isNowPlaying flags - use UPDATE_NOW_PLAYING_FLAGS for that.
   *
   * Uses jobId dedupe: same movie won't be synced twice in the same day (UTC).
   */
  private async processNowPlaying(region = 'UA'): Promise<void> {
    this.logger.log(`Syncing now playing movies (region: ${region})...`);

    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    this.logger.log(`Found ${tmdbIds.length} now playing movies`);

    if (tmdbIds.length === 0) return;

    // Day key in UTC for consistent dedupe across timezones
    const today = formatUtcDayId();

    let deduped = 0;
    const jobsToAdd: any[] = [];
    const enqueuedIds: number[] = [];

    // Chunk for parallel checks to avoid Redis pressure
    for (let i = 0; i < tmdbIds.length; i += this.CHECK_CONCURRENCY) {
      const chunk = tmdbIds.slice(i, i + this.CHECK_CONCURRENCY);
      const chunkChecks = await Promise.all(
        chunk.map(async (tmdbId) => {
          const jobId = `movie_${tmdbId}_${today}`;
          const existing = await this.ingestionQueue.getJob(jobId);
          return { tmdbId, existing, jobId };
        }),
      );

      for (const { tmdbId, existing, jobId } of chunkChecks) {
        if (existing) {
          deduped++;
          continue;
        }

        jobsToAdd.push({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId },
          opts: { jobId },
        });
        enqueuedIds.push(tmdbId);
      }
    }

    if (jobsToAdd.length > 0) {
      await this.ingestionQueue.addBulk(jobsToAdd);
    }

    const sampleIds =
      enqueuedIds.length > 0 ? `, sample=[${enqueuedIds.slice(0, 5).join(',')}]` : '';
    this.logger.log(
      `Now playing ingestion complete: found=${tmdbIds.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${sampleIds}`,
    );
  }

  /**
   * Updates isNowPlaying flags based on current TMDB now_playing list.
   * - Sets isNowPlaying = true for movies in the list that exist in DB
   * - Sets isNowPlaying = false for movies no longer in the list
   *
   * Safety mechanism:
   * Checks if TMDB items exist in DB. If missing, queues SYNC_MOVIE jobs (best-effort).
   * This ensures we don't have "now playing" movies that are missing from the catalog.
   */
  private async updateNowPlayingFlags(region = 'UA'): Promise<void> {
    this.logger.log(`Updating now playing flags (region: ${region})...`);

    // Fetch fresh now_playing list from TMDB
    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    this.logger.log(`Found ${tmdbIds.length} now playing movies in TMDB`);

    if (tmdbIds.length === 0) {
      await this.movieRepository.setNowPlaying([]);
      return;
    }

    // Check which ones exist in DB
    const existingItems = await this.mediaRepository.findManyByTmdbIds(tmdbIds);
    const existingTmdbIds = new Set(existingItems.map((i) => i.tmdbId));
    const missingIds = tmdbIds.filter((id) => !existingTmdbIds.has(id));

    this.logger.log(
      `Now playing stats: TMDB=${tmdbIds.length}, DB=${existingItems.length}, Missing=${missingIds.length}`,
    );

    // Queue sync for missing items (best-effort)
    if (missingIds.length > 0) {
      this.logger.warn(
        `Found ${missingIds.length} now playing movies missing from DB. Queueing sync...`,
      );

      const today = formatUtcDayId();
      const jobs = missingIds.map((tmdbId) => ({
        name: IngestionJob.SYNC_MOVIE,
        data: { tmdbId },
        opts: { jobId: `movie_${tmdbId}_${today}` }, // Dedupe with daily sync
      }));

      await this.ingestionQueue.addBulk(jobs);
    }

    // Update flags in DB (sets true for those in list, false for others)
    await this.movieRepository.setNowPlaying(tmdbIds);

    this.logger.log(
      `Now playing flags updated for ${tmdbIds.length} movies (effective: ${existingItems.length})`,
    );
  }

  /**
   * Syncs new theatrical releases from TMDB.
   * Uses discover endpoint with release date filters.
   *
   * Dedupe strategy:
   * - Dispatcher job: deduplicated by region/daysBack/date (unless force=true)
   * - Item jobs: deduplicated by movie_id/date (movie_{tmdbId}_{YYYYMMDD})
   */
  private async processNewReleases(region = 'UA', daysBack = 30): Promise<void> {
    this.logger.log(`Syncing new releases (region: ${region}, daysBack: ${daysBack})...`);

    // Get IDs from TMDB discover
    const tmdbIds = await this.tmdbAdapter.getNewReleaseIds(daysBack, region);

    if (tmdbIds.length === 0) {
      this.logger.log(`New releases: found=0`);
      return;
    }

    // Day key in UTC for consistent dedupe
    const today = formatUtcDayId();

    let deduped = 0;
    const jobsToAdd: any[] = [];
    const enqueuedIds: number[] = [];

    // Chunk for parallel checks to avoid Redis pressure
    for (let i = 0; i < tmdbIds.length; i += this.CHECK_CONCURRENCY) {
      const chunk = tmdbIds.slice(i, i + this.CHECK_CONCURRENCY);
      const chunkChecks = await Promise.all(
        chunk.map(async (tmdbId) => {
          const jobId = `movie_${tmdbId}_${today}`;
          const existing = await this.ingestionQueue.getJob(jobId);
          return { tmdbId, existing, jobId };
        }),
      );

      for (const { tmdbId, existing, jobId } of chunkChecks) {
        if (existing) {
          deduped++;
          continue;
        }

        jobsToAdd.push({
          name: IngestionJob.SYNC_MOVIE,
          data: { tmdbId },
          opts: { jobId },
        });
        enqueuedIds.push(tmdbId);
      }
    }

    if (jobsToAdd.length > 0) {
      await this.ingestionQueue.addBulk(jobsToAdd);
    }

    const sampleIds =
      enqueuedIds.slice(0, 5).length > 0 ? `, sample=[${enqueuedIds.slice(0, 5).join(',')}]` : '';
    this.logger.log(
      `New releases region=${region} daysBack=${daysBack}: found=${tmdbIds.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${sampleIds}`,
    );
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
