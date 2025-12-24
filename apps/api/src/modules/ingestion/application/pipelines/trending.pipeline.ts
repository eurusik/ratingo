import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SyncMediaService } from '../services/sync-media.service';
import { StatsService } from '../../../stats/application/services/stats.service';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '@/common/enums/media-type.enum';
import { formatUtcDayId } from '@/common/utils/date.util';
import { preDedupeBulk, formatHourWindow, formatSample } from '../helpers/queue.helpers';

/**
 * Trending pipeline: handles TMDB trending sync and Trakt stats updates.
 * Supports dispatcher/page job pattern with hour-based deduplication.
 */
@Injectable()
export class TrendingPipeline {
  private readonly logger = new Logger(TrendingPipeline.name);
  private readonly CHECK_CONCURRENCY = 50;

  constructor(
    private readonly syncService: SyncMediaService,
    private readonly statsService: StatsService,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Dispatcher: queues page jobs for movies and shows.
   * Each page job syncs 20 items from TMDB trending.
   * Stats job is queued separately with delay.
   */
  async dispatch(pages = 5, syncStats = true, force = false): Promise<void> {
    const dispatcherStartedAt = new Date();
    const window = force ? dispatcherStartedAt.getTime().toString() : formatHourWindow();

    this.logger.log(
      `Starting trending dispatcher (pages: ${pages}, syncStats: ${syncStats}, force: ${force})...`,
    );

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

    const { jobsToAdd, deduped, sample } = await preDedupeBulk(
      jobs,
      this.ingestionQueue,
      this.CHECK_CONCURRENCY,
    );

    if (jobsToAdd.length > 0) {
      await this.ingestionQueue.addBulk(jobsToAdd);
    }

    this.logger.log(
      `Trending dispatcher progress: found=${jobs.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${formatSample(sample)}`,
    );

    if (syncStats) {
      const expectedLimit = pages * 20 * 2;
      await this.ingestionQueue.add(
        IngestionJob.SYNC_TRENDING_STATS,
        {
          since: dispatcherStartedAt.toISOString(),
          limit: expectedLimit,
        },
        {
          jobId: `trending-stats_${window}`,
          delay: 3 * 60 * 1000,
        },
      );
      this.logger.log(`Queued trending stats job (delay: 3min, limit: ${expectedLimit})`);
    }

    this.logger.log(
      `Trending dispatcher complete: found=${jobs.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}`,
    );
  }

  /**
   * Processes a single trending page: fetches items and enqueues sync jobs.
   */
  async processPage(type: MediaType, page: number, jobId?: string): Promise<void> {
    const logPrefix = `[${type}:p${page}${jobId ? ` job:${jobId}` : ''}]`;
    this.logger.log(`${logPrefix} Processing...`);

    const items = await this.syncService.getTrending(page, type);

    if (items.length === 0) {
      this.logger.log(`${logPrefix} found=0`);
      return;
    }

    const today = formatUtcDayId();
    const jobs = items.map((item, i) => {
      const rank = (page - 1) * 20 + i + 1;
      const score = 10000 - rank + 1;
      const trending = { score, rank };
      const jobName =
        item.type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW;

      return {
        name: jobName,
        data: { tmdbId: item.tmdbId, trending },
        opts: { jobId: `${item.type}_${item.tmdbId}_${today}` },
      };
    });

    const { jobsToAdd, deduped, sample } = await preDedupeBulk(
      jobs,
      this.ingestionQueue,
      this.CHECK_CONCURRENCY,
    );

    if (jobsToAdd.length > 0) {
      await this.ingestionQueue.addBulk(jobsToAdd);
    }

    const enqueuedIds = jobsToAdd.map((j) => j.data.tmdbId);
    const sampleIds =
      enqueuedIds.slice(0, 5).length > 0 ? `, sample=[${enqueuedIds.slice(0, 5).join(',')}]` : '';

    this.logger.log(
      `${logPrefix} found=${items.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${sampleIds}`,
    );
  }

  /**
   * Syncs Trakt stats for recently updated trending items.
   */
  async processStats(since?: string, limit?: number): Promise<void> {
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
   * @deprecated Full trending sync (legacy). Use dispatcher pattern instead.
   */
  async processFull(page = 1, syncStats = true, type?: MediaType): Promise<void> {
    this.logger.log(
      `Starting full trending sync (page: ${page}, syncStats: ${syncStats}, type: ${type || 'all'})...`,
    );

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

    this.logger.log(`Full trending sync complete: ${items.length} items processed`);
  }
}
