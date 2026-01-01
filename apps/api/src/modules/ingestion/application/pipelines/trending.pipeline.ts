import { Injectable, Logger } from '@nestjs/common';

import { MediaType } from '@/common/enums/media-type.enum';
import { formatUtcDayId } from '@/common/utils/date.util';

import { StatsService } from '../../../stats/public';
import {
  IngestionJob,
  TRENDING_STATS_DELAY_MS,
  TRENDING_DEFAULT_PAGES,
  TRENDING_DEFAULT_STATS_LIMIT,
  TMDB_TRENDING_PAGE_SIZE,
} from '../../ingestion.constants';
import { formatHourWindow } from '../helpers/queue.helpers';
import { BulkJobService } from '../services/bulk-job.service';
import { SyncMediaService } from '../services/sync-media.service';

/**
 * Trending pipeline: TMDB trending sync and Trakt stats updates.
 *
 * Uses dispatcher/page job pattern with hour-based deduplication.
 */
@Injectable()
export class TrendingPipeline {
  private readonly logger = new Logger(TrendingPipeline.name);

  constructor(
    private readonly syncService: SyncMediaService,
    private readonly bulkJobService: BulkJobService,
    private readonly statsService: StatsService,
  ) {}

  /**
   * Dispatches page jobs for movies and shows.
   *
   * @param pages - Number of pages to sync per type (default: 5)
   * @param syncStats - Whether to queue stats job (default: true)
   * @param force - Bypass hour-based deduplication (default: false)
   */
  async dispatch(pages = TRENDING_DEFAULT_PAGES, syncStats = true, force = false): Promise<void> {
    const startedAt = new Date();
    const window = force ? startedAt.getTime().toString() : formatHourWindow();

    this.logger.log(
      `Starting trending dispatcher (pages: ${pages}, syncStats: ${syncStats}, force: ${force})...`,
    );

    const jobs = this.buildPageJobs(pages, window);
    const result = await this.bulkJobService.enqueueBulk(jobs, this.logger, 'Trending dispatcher');

    if (syncStats) {
      await this.queueStatsJob(startedAt, pages, window);
    }

    this.logger.log(
      `Trending dispatcher complete: found=${result.found}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }

  /** Processes a single trending page: fetches items and enqueues sync jobs. */
  async processPage(type: MediaType, page: number, jobId?: string): Promise<void> {
    const logPrefix = `[${type}:p${page}${jobId ? ` job:${jobId}` : ''}]`;
    this.logger.log(`${logPrefix} Processing...`);

    const items = await this.syncService.getTrending(page, type);

    if (items.length === 0) {
      this.logger.log(`${logPrefix} found=0`);
      return;
    }

    const jobs = this.buildSyncJobs(items, page);
    await this.bulkJobService.enqueueBulk(jobs, this.logger, logPrefix);
  }

  /** Syncs Trakt stats for recently updated trending items. */
  async processStats(since?: string, limit?: number): Promise<void> {
    const sinceDate = since ? new Date(since) : undefined;
    this.logger.log(
      `Syncing Trakt stats (since: ${sinceDate?.toISOString() || 'all'}, limit: ${limit || 'default'})...`,
    );

    const result = await this.statsService.syncTrendingStatsForUpdatedItems({
      since: sinceDate,
      limit: limit || TRENDING_DEFAULT_STATS_LIMIT,
    });

    this.logger.log(`Trending stats sync complete: ${result.movies} movies, ${result.shows} shows`);
  }

  /**
   * @deprecated Use dispatcher pattern instead.
   */
  async processFull(page = 1, syncStats = true, type?: MediaType): Promise<void> {
    this.logger.log(`Starting full trending sync (page: ${page}, type: ${type || 'all'})...`);

    const items = await this.syncService.getTrending(page, type);

    for (const item of items) {
      if (item.type === MediaType.MOVIE) {
        await this.syncService.syncMovie(item.tmdbId);
      } else {
        await this.syncService.syncShow(item.tmdbId);
      }
    }

    if (syncStats) {
      await this.statsService.syncTrendingStats();
    }

    this.logger.log(`Full trending sync complete: ${items.length} items`);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private buildPageJobs(pages: number, window: string) {
    const types: MediaType[] = [MediaType.MOVIE, MediaType.SHOW];
    const jobs = [];

    for (const type of types) {
      for (let page = 1; page <= pages; page++) {
        jobs.push({
          name: IngestionJob.SYNC_TRENDING_PAGE,
          data: { type, page },
          opts: { jobId: `trending_${type}_${page}_${window}` },
        });
      }
    }

    return jobs;
  }

  private buildSyncJobs(items: Array<{ tmdbId: number; type: MediaType }>, page: number) {
    const today = formatUtcDayId();
    const baseScore = 10000;

    return items.map((item, i) => {
      const rank = (page - 1) * TMDB_TRENDING_PAGE_SIZE + i + 1;
      const score = baseScore - rank + 1;

      return {
        name: item.type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW,
        data: { tmdbId: item.tmdbId, trending: { score, rank } },
        opts: { jobId: `${item.type}_${item.tmdbId}_${today}` },
      };
    });
  }

  private async queueStatsJob(startedAt: Date, pages: number, window: string): Promise<void> {
    const expectedLimit = pages * TMDB_TRENDING_PAGE_SIZE * 2;

    await this.bulkJobService.addDelayed(
      IngestionJob.SYNC_TRENDING_STATS,
      { since: startedAt.toISOString(), limit: expectedLimit },
      `trending-stats_${window}`,
      TRENDING_STATS_DELAY_MS,
    );

    this.logger.log(`Queued trending stats job (delay: 3min, limit: ${expectedLimit})`);
  }
}
