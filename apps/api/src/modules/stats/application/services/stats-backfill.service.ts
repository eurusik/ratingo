import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { MediaType } from '@/common/enums/media-type.enum';

import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import { type TraktRatingsPort, TRAKT_RATINGS_PORT } from '../../../ingestion/public';
import {
  type IStatsRepository,
  STATS_REPOSITORY,
} from '../../domain/repositories/stats.repository.interface';
import {
  type BackfillTotalWatchersOptions,
  type QueueWatchersCountBackfillOptions,
} from '../../domain/types/stats.types';
import { BACKFILL_CONFIG, STATS_JOBS, STATS_QUEUE } from '../../stats.constants';
import { type BackfillChunkItem } from '../types/backfill.types';

/**
 * Service for backfilling missing or corrupted stats data.
 */
@Injectable()
export class StatsBackfillService {
  private readonly logger = new Logger(StatsBackfillService.name);

  constructor(
    @Inject(TRAKT_RATINGS_PORT)
    private readonly traktRatingsPort: TraktRatingsPort,

    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,

    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,

    @InjectQueue(STATS_QUEUE)
    private readonly statsQueue: Queue,
  ) {}

  /**
   * Backfills total_watchers for items that have corrupted data.
   * Finds items where total_watchers = 0 but have Trakt votes (indicating API failure during sync).
   *
   * @param options - Backfill options
   * @param options.type - Filter by media type (movie/show)
   * @param options.limit - Max items to process
   * @param options.minVotes - Minimum Trakt votes to consider (default: 100)
   * @returns Count of backfilled items
   */
  async backfillTotalWatchers(
    options: BackfillTotalWatchersOptions,
  ): Promise<{ total: number; success: number; failed: number }> {
    const limit = options.limit ?? 100;
    const minVotes = options.minVotes ?? 100;

    this.logger.log(
      `Starting total_watchers backfill (type: ${options.type ?? 'all'}, limit: ${limit}, minVotes: ${minVotes})...`,
    );

    // Find items with corrupted data: total_watchers = 0 but have Trakt votes
    const corruptedItems = await this.mediaRepository.findItemsWithMissingWatchers({
      type: options.type,
      limit,
      minVotes,
    });

    if (corruptedItems.length === 0) {
      this.logger.log('No corrupted items found');
      return { total: 0, success: 0, failed: 0 };
    }

    this.logger.log(`Found ${corruptedItems.length} items with missing total_watchers`);

    let success = 0;
    let failed = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    const BASE_DELAY_MS = 200;

    // Process items with exponential backoff on rate limiting
    for (const item of corruptedItems) {
      const stats = await this.fetchStatsWithRetry(item.type, item.tmdbId);

      if (stats && stats.watchers > 0) {
        await this.statsRepository.updateTotalWatchers(item.id, stats.watchers);
        success++;
        consecutiveFailures = 0;
        this.logger.debug(
          `Updated ${item.type} ${item.tmdbId}: total_watchers = ${stats.watchers}`,
        );
      } else if (stats === null) {
        // Transient error - count as failure and apply backoff
        failed++;
        consecutiveFailures++;

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.logger.warn(
            `Stopping backfill after ${MAX_CONSECUTIVE_FAILURES} consecutive failures (possible rate limiting)`,
          );
          break;
        }

        // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms
        const backoffDelay = BASE_DELAY_MS * Math.pow(2, consecutiveFailures);
        this.logger.debug(`Backing off for ${backoffDelay}ms after failure`);
        await this.sleep(backoffDelay);
        continue;
      } else {
        // No data found (not an error, just no watchers)
        this.logger.debug(`No watchers data for ${item.type} ${item.tmdbId}`);
        failed++;
        consecutiveFailures = 0;
      }

      // Base delay between requests to avoid rate limiting
      await this.sleep(BASE_DELAY_MS);
    }

    this.logger.log(`Backfill complete: ${success} success, ${failed} failed`);
    return { total: corruptedItems.length, success, failed };
  }

  /**
   * Queues backfill jobs for items with corrupted watchers_count.
   * Splits work into chunks and processes via BullMQ for proper rate limiting.
   *
   * @param options.type - Filter by media type (movie/show)
   * @param options.limit - Max items to process
   * @param options.minTotalWatchers - Minimum total_watchers to consider (default: 100)
   * @returns Number of items found and jobs queued
   */
  async queueWatchersCountBackfill(
    options: QueueWatchersCountBackfillOptions,
  ): Promise<{ total: number; chunksQueued: number }> {
    const limit = options.limit ?? 500;
    const minTotalWatchers = options.minTotalWatchers ?? 100;

    this.logger.log(
      `Queueing watchers_count backfill (type: ${options.type ?? 'all'}, limit: ${limit}, minTotalWatchers: ${minTotalWatchers})...`,
    );

    // Find items with corrupted data
    const corruptedItems = await this.mediaRepository.findItemsWithCorruptedWatchersCount({
      type: options.type,
      limit,
      minTotalWatchers,
    });

    if (corruptedItems.length === 0) {
      this.logger.log('No items with corrupted watchers_count found');
      return { total: 0, chunksQueued: 0 };
    }

    this.logger.log(`Found ${corruptedItems.length} items with corrupted watchers_count`);

    // Split into chunks
    const chunks: Array<{ id: string; tmdbId: number; type: MediaType }[]> = [];
    for (let i = 0; i < corruptedItems.length; i += BACKFILL_CONFIG.CHUNK_SIZE) {
      chunks.push(corruptedItems.slice(i, i + BACKFILL_CONFIG.CHUNK_SIZE));
    }

    // Queue each chunk as a separate job with staggered delays
    for (let i = 0; i < chunks.length; i++) {
      await this.statsQueue.add(
        STATS_JOBS.BACKFILL_WATCHERS_CHUNK,
        {
          items: chunks[i],
          chunkIndex: i,
          totalChunks: chunks.length,
        },
        {
          delay: i * BACKFILL_CONFIG.CHUNK_DELAY_MS, // Stagger chunks
          attempts: BACKFILL_CONFIG.MAX_RETRIES,
          backoff: {
            type: 'exponential',
            delay: BACKFILL_CONFIG.BACKOFF_BASE_MS,
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for inspection
        },
      );
    }

    this.logger.log(`Queued ${chunks.length} backfill chunks for ${corruptedItems.length} items`);
    return { total: corruptedItems.length, chunksQueued: chunks.length };
  }

  /**
   * Processes a single chunk of items for watchers_count backfill.
   * Called by the worker. Throws on rate limiting so BullMQ can retry.
   *
   * @param items - Items to process in this chunk
   * @returns Processing results
   */
  async processWatchersChunk(
    items: BackfillChunkItem[],
  ): Promise<{ success: number; failed: number }> {
    const movieItems = items.filter((i) => i.type === MediaType.MOVIE);
    const showItems = items.filter((i) => i.type === MediaType.SHOW);

    let success = 0;
    let failed = 0;

    // Process movies one by one to properly handle rate limiting
    for (const item of movieItems) {
      try {
        const watchersMap = await this.traktRatingsPort.getMovieWatchersByTmdbIds([item.tmdbId], 1);
        const watchers = watchersMap.get(item.tmdbId);

        if (watchers !== null && watchers !== undefined) {
          await this.statsRepository.updateWatchersCount(item.id, watchers);
          success++;
          this.logger.debug(`Updated movie ${item.tmdbId}: watchers_count = ${watchers}`);
        } else {
          // null = API error, don't update (preserve existing data)
          failed++;
          this.logger.debug(`Skipped movie ${item.tmdbId}: no data from API`);
        }
      } catch (error) {
        // Re-throw rate limit errors so BullMQ can retry the whole chunk
        if (this.isRateLimitError(error)) {
          this.logger.warn(`Rate limited processing movie ${item.tmdbId}, will retry chunk`);
          throw error;
        }
        failed++;
        this.logger.warn(`Failed to process movie ${item.tmdbId}: ${(error as Error).message}`);
      }
    }

    // Process shows one by one
    for (const item of showItems) {
      try {
        const watchersMap = await this.traktRatingsPort.getShowWatchersByTmdbIds([item.tmdbId], 1);
        const watchers = watchersMap.get(item.tmdbId);

        if (watchers !== null && watchers !== undefined) {
          await this.statsRepository.updateWatchersCount(item.id, watchers);
          success++;
          this.logger.debug(`Updated show ${item.tmdbId}: watchers_count = ${watchers}`);
        } else {
          failed++;
          this.logger.debug(`Skipped show ${item.tmdbId}: no data from API`);
        }
      } catch (error) {
        if (this.isRateLimitError(error)) {
          this.logger.warn(`Rate limited processing show ${item.tmdbId}, will retry chunk`);
          throw error;
        }
        failed++;
        this.logger.warn(`Failed to process show ${item.tmdbId}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`Chunk complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Checks if an error is a rate limit error (429).
   */
  private isRateLimitError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { status?: number; response?: { status?: number } };
    return err.status === 429 || err.response?.status === 429;
  }

  /**
   * Fetches stats with retry logic and exponential backoff.
   *
   * @param type - Media type
   * @param tmdbId - TMDB ID
   * @param maxRetries - Maximum retry attempts
   * @returns Stats or null on transient failure, undefined if not found
   */
  private async fetchStatsWithRetry(
    type: MediaType,
    tmdbId: number,
    maxRetries = 3,
  ): Promise<{ watchers: number } | null | undefined> {
    const BASE_RETRY_DELAY_MS = 500;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stats =
          type === MediaType.MOVIE
            ? await this.traktRatingsPort.getMovieStatsByTmdbId(tmdbId)
            : await this.traktRatingsPort.getShowStatsByTmdbId(tmdbId);

        return stats; // Success or not found
      } catch (error: unknown) {
        const err = error as { response?: { status?: number }; message?: string };
        const status = err?.response?.status;
        const isRateLimited = status === 429;
        const isServerError = status && status >= 500;

        if (isRateLimited || isServerError) {
          if (attempt < maxRetries) {
            const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
            this.logger.debug(
              `Retry ${attempt + 1}/${maxRetries} for ${type} ${tmdbId} after ${delay}ms (status: ${status})`,
            );
            await this.sleep(delay);
            continue;
          }
        }

        this.logger.warn(`Failed to fetch stats for ${type} ${tmdbId}: ${err.message || error}`);
        return null; // Transient failure
      }
    }

    return null;
  }

  /**
   * Promise-based sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
