import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { MediaType } from '@/common/enums/media-type.enum';

import {
  type ICatalogPolicyEvaluator,
  CATALOG_POLICY_EVALUATOR,
  EvaluationContext,
} from '../../../catalog-policy/public';
import { TrendingSyncService, HOMEPAGE_REFRESH_CONFIG } from '../../../stats/public';
import { buildSyncMediaJobId } from '../../domain/job-ids';
import {
  IngestionJob,
  TRENDING_STATS_DELAY_MS,
  TRENDING_DEFAULT_PAGES,
  TRENDING_DEFAULT_STATS_LIMIT,
  TMDB_TRENDING_PAGE_SIZE,
  ELIGIBLE_BACKFILL_MAX_BATCHES,
} from '../../ingestion.constants';
import { formatHourWindow } from '../helpers/queue.helpers';
import { BulkJobService } from '../services/bulk-job.service';
import { SyncMediaService } from '../services/sync-media.service';

/** Multiplier for percentage calculation (0-1 to 0-100). */
const PERCENT_MULTIPLIER = 100;

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
    private readonly trendingSyncService: TrendingSyncService,

    @Optional()
    @Inject(CATALOG_POLICY_EVALUATOR)
    private readonly catalogEvaluator?: ICatalogPolicyEvaluator,
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

    const rawItems = await this.syncService.getTrending(page, type);
    const items = rawItems.filter(
      (item): item is { tmdbId: number; type: MediaType } =>
        typeof item.tmdbId === 'number' &&
        item.tmdbId > 0 &&
        (item.type === MediaType.MOVIE || item.type === MediaType.SHOW),
    );

    if (items.length === 0) {
      this.logger.log(`${logPrefix} found=0`);
      return;
    }

    if (items.length < rawItems.length) {
      this.logger.warn(
        `${logPrefix} Dropped ${rawItems.length - items.length} items with invalid shape`,
      );
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

    // Phase 0: Clear stale trending ranks from items not updated in this sync cycle
    if (sinceDate) {
      const cleared = await this.trendingSyncService.clearStaleTrendingRanks(sinceDate);
      this.logger.log(`Phase 0 complete: cleared ${cleared} stale trending ranks`);
    }

    // Phase 1: Sync stats for recently updated items (top trending from TMDB)
    const result = await this.trendingSyncService.syncTrendingStatsForUpdatedItems({
      since: sinceDate,
      limit: limit || TRENDING_DEFAULT_STATS_LIMIT,
    });

    this.logger.log(`Phase 1 complete: ${result.movies} movies, ${result.shows} shows`);

    // Phase 2: Backfill watchers for ELIGIBLE items not in top trending (watchers_count = 0)
    await this.syncEligibleTrendingBackfill();

    // Phase 3: Refresh stale hero candidates (watchers_count > 0 but updated_at > 24h)
    await this.syncHeroCandidatesRefresh();

    // Log eligibility stats for monitoring Policy Engine effectiveness
    await this.logEligibilityStats();
  }

  /**
   * Refreshes stats for homepage candidates (Hero + Watching-Now) with stale data.
   * Targets items that already have watchers_count > 0 but haven't been updated in 24h.
   * Uses lower quality threshold (50) to cover both Hero (60) and Watching-Now (50).
   * Non-critical: failures are logged but don't stop the pipeline.
   */
  private async syncHeroCandidatesRefresh(): Promise<void> {
    try {
      this.logger.log('Starting homepage candidates refresh...');

      const result = await this.trendingSyncService.syncHeroCandidatesStats({
        staleThresholdHours: HOMEPAGE_REFRESH_CONFIG.STALE_THRESHOLD_HOURS,
        limit: HOMEPAGE_REFRESH_CONFIG.BATCH_SIZE,
        minQualityScore: HOMEPAGE_REFRESH_CONFIG.MIN_QUALITY_SCORE,
      });

      this.logger.log(
        `Homepage candidates refresh complete: ${result.movies} movies, ${result.shows} shows`,
      );
    } catch (error) {
      this.logger.warn(`Homepage candidates refresh failed: ${(error as Error).message}`);
    }
  }

  /**
   * Backfills watchers data for ELIGIBLE trending items with watchers_count = 0.
   * Runs in limited batches to avoid rate limiting. Remaining items processed in next run.
   */
  private async syncEligibleTrendingBackfill(): Promise<void> {
    this.logger.log('Starting eligible trending backfill...');

    let totalSynced = 0;
    let offset = 0;
    let batchCount = 0;
    let hasMoreRemaining = false;
    const batchSize = TRENDING_DEFAULT_STATS_LIMIT;

    // Process limited batches to avoid rate limiting
    while (batchCount < ELIGIBLE_BACKFILL_MAX_BATCHES) {
      const result = await this.trendingSyncService.syncEligibleTrendingStats({
        batchSize,
        offset,
      });

      totalSynced += result.total;
      batchCount++;
      hasMoreRemaining = result.hasMore;

      if (!result.hasMore || result.total === 0) {
        break;
      }

      offset += batchSize;
    }

    this.logger.log(
      `Eligible trending backfill complete: processed=${totalSynced}, ` +
        `batches=${batchCount}/${ELIGIBLE_BACKFILL_MAX_BATCHES}, ` +
        `hasMore=${hasMoreRemaining}`,
    );
  }

  /** Logs eligibility statistics for trending context. */
  private async logEligibilityStats(): Promise<void> {
    if (!this.catalogEvaluator) return;

    try {
      const stats = await this.catalogEvaluator.getEligibilityStats(EvaluationContext.TRENDING);
      const eligibilityRate =
        stats.total > 0 ? ((stats.eligible / stats.total) * PERCENT_MULTIPLIER).toFixed(1) : '0';

      this.logger.log(
        `Trending eligibility: total=${stats.total}, eligible=${stats.eligible}, ` +
          `ineligible=${stats.ineligible}, rate=${eligibilityRate}%`,
      );
    } catch (error) {
      this.logger.warn(`Failed to get eligibility stats: ${(error as Error).message}`);
    }
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
      await this.trendingSyncService.syncTrendingStats();
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
    const baseScore = 10000;

    return items.map((item, i) => {
      const rank = (page - 1) * TMDB_TRENDING_PAGE_SIZE + i + 1;
      const score = baseScore - rank + 1;
      const mediaType = item.type === MediaType.MOVIE ? 'movie' : 'show';

      return {
        name: item.type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW,
        data: { tmdbId: item.tmdbId, trending: { score, rank } },
        opts: { jobId: buildSyncMediaJobId(mediaType, item.tmdbId, 'daily') },
      };
    });
  }

  private async queueStatsJob(startedAt: Date, _pages: number, window: string): Promise<void> {
    // Use constant limit instead of dynamic calculation to avoid rate limiting.
    // With 4 API calls per item and ~3 req/s rate limit, 50 items takes ~70 seconds.
    const limit = TRENDING_DEFAULT_STATS_LIMIT;

    await this.bulkJobService.addDelayed(
      IngestionJob.SYNC_TRENDING_STATS,
      { since: startedAt.toISOString(), limit },
      `trending-stats_${window}`,
      TRENDING_STATS_DELAY_MS,
    );

    this.logger.log(`Queued trending stats job (delay: 3min, limit: ${limit})`);
  }
}
