import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

import { type Queue } from 'bullmq';

import { DEFAULT_BATCH_SIZE, MAX_PAGE_SIZE } from '../../../../common/constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { AdminJwtGuard } from '../../../auth/infrastructure/guards/admin-jwt.guard';
import {
  DropOffService,
  ScoreRecalculationService,
  StatsBackfillService,
  StatsQueryService,
} from '../../application/services';
import { STATS_QUEUE, STATS_JOBS } from '../../stats.constants';
import {
  BackfillTotalWatchersQueryDto,
  BackfillWatchersCountQueryDto,
  RecalculateScoresQueryDto,
  SyncTrendingQueryDto,
  AnalyzeDropOffQueryDto,
} from '../dto';

/**
 * REST controller for media statistics endpoints.
 * Provides endpoints for syncing and retrieving real-time stats and drop-off analysis.
 */
@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsQueryService: StatsQueryService,
    private readonly scoreRecalculationService: ScoreRecalculationService,
    private readonly statsBackfillService: StatsBackfillService,
    private readonly dropOffService: DropOffService,
    @InjectQueue(STATS_QUEUE) private readonly statsQueue: Queue,
  ) {}

  /**
   * Triggers stats sync job.
   *
   * @param {number} limit - Number of items to sync
   * @returns {Promise<any>} Job info
   */
  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiTags('Service: Stats')
  @ApiOperation({
    summary: 'Sync trending stats from Trakt',
    description:
      'Adds a job to the queue to fetch current watchers count and trending rank from Trakt API.',
  })
  async syncTrendingStats(@Query() query: SyncTrendingQueryDto) {
    const job = await this.statsQueue.add(STATS_JOBS.SYNC_TRENDING, {
      limit: query.limit || MAX_PAGE_SIZE,
    });

    return {
      message: 'Stats sync job added to queue',
      jobId: job.id,
    };
  }

  /**
   * Gets stats by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID of the media item
   * @returns {Promise<any>} Stats payload
   */
  @Get('tmdb/:tmdbId')
  @ApiTags('Public: Stats')
  @ApiOperation({
    summary: 'Get stats by TMDB ID',
    description: 'Returns current watchers count and trending rank for a media item.',
  })
  @ApiParam({ name: 'tmdbId', type: Number, description: 'TMDB ID of the media item' })
  async getStatsByTmdbId(@Param('tmdbId') tmdbId: number) {
    return this.statsQueryService.getStatsByTmdbId(tmdbId);
  }

  // === DROP-OFF ANALYSIS ===

  /**
   * Triggers drop-off analysis job.
   *
   * @param {number} tmdbId - Optional show TMDB ID to analyze
   * @param {number} limit - Max shows to analyze
   * @returns {Promise<any>} Job info
   */
  @Post('drop-off/analyze')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiTags('Service: Stats')
  @ApiOperation({
    summary: 'Analyze drop-off for shows',
    description:
      'Adds a job to analyze viewer drop-off for shows. Can analyze a single show or all shows.',
  })
  async analyzeDropOff(@Query() query: AnalyzeDropOffQueryDto) {
    const job = await this.statsQueue.add(STATS_JOBS.ANALYZE_DROP_OFF, {
      tmdbId: query.tmdbId,
      limit: query.limit || DEFAULT_BATCH_SIZE,
    });

    return {
      message: query.tmdbId
        ? `Drop-off analysis job for show ${query.tmdbId} added to queue`
        : `Drop-off analysis job for ${query.limit || DEFAULT_BATCH_SIZE} shows added to queue`,
      jobId: job.id,
    };
  }

  /**
   * Triggers drop-off analysis for a specific show.
   *
   * @param {number} tmdbId - TMDB ID of the show
   * @returns {Promise<any>} Job info
   */
  @Post('drop-off/analyze/:tmdbId')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiTags('Service: Stats')
  @ApiOperation({
    summary: 'Analyze drop-off for a specific show',
    description: 'Analyzes viewer drop-off for a single show by TMDB ID. Runs in background.',
  })
  @ApiParam({ name: 'tmdbId', type: Number, description: 'TMDB ID of the show to analyze' })
  async analyzeDropOffById(@Param('tmdbId') tmdbId: number) {
    const job = await this.statsQueue.add(STATS_JOBS.ANALYZE_DROP_OFF, { tmdbId });

    return {
      message: `Drop-off analysis job for show ${tmdbId} added to queue`,
      jobId: job.id,
    };
  }

  /**
   * Gets drop-off analysis results.
   *
   * @param {number} tmdbId - TMDB ID of the show
   * @returns {Promise<any>} Analysis payload
   */
  @Get('drop-off/tmdb/:tmdbId')
  @ApiTags('Public: Stats')
  @ApiOperation({
    summary: 'Get drop-off analysis for a show',
    description:
      'Returns pre-calculated drop-off analysis including drop-off point, engagement metrics, and insights.',
  })
  @ApiParam({ name: 'tmdbId', type: Number, description: 'TMDB ID of the show' })
  async getDropOffAnalysis(@Param('tmdbId') tmdbId: number) {
    const analysis = await this.dropOffService.getAnalysis(tmdbId);
    if (!analysis) {
      return {
        message: 'No drop-off analysis available. Run POST /stats/drop-off/analyze/{tmdbId} first.',
        tmdbId,
      };
    }
    return analysis;
  }

  // === BACKFILL ===

  /**
   * Backfills total_watchers for items with corrupted data.
   * Finds items where total_watchers = 0 but have Trakt votes (indicating API failure during sync).
   */
  @Post('backfill/total-watchers')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiTags('Service: Stats')
  @ApiOperation({
    summary: 'Backfill total_watchers for corrupted items',
    description:
      'Finds items where total_watchers = 0 but have Trakt votes, then re-fetches from Trakt API.',
  })
  async backfillTotalWatchers(@Query() query: BackfillTotalWatchersQueryDto) {
    const mediaType =
      query.type === 'movie' ? MediaType.MOVIE : query.type === 'show' ? MediaType.SHOW : undefined;

    const result = await this.statsBackfillService.backfillTotalWatchers({
      type: mediaType,
      limit: query.limit,
      minVotes: query.minVotes,
    });

    return {
      message: 'Backfill complete',
      ...result,
    };
  }

  /**
   * Queues backfill jobs for watchers_count (live watchers) for items with corrupted data.
   * Finds items where watchers_count = 0 but total_watchers > minTotalWatchers,
   * then queues chunk jobs to re-fetch from Trakt API with proper rate limiting.
   */
  @Post('backfill/watchers-count')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiTags('Service: Stats')
  @ApiOperation({
    summary: 'Queue backfill jobs for watchers_count',
    description:
      'Finds items where watchers_count = 0 but total_watchers > threshold, then queues chunk jobs to re-fetch live watchers from Trakt API with proper rate limiting and exponential backoff.',
  })
  async backfillWatchersCount(@Query() query: BackfillWatchersCountQueryDto) {
    const mediaType =
      query.type === 'movie' ? MediaType.MOVIE : query.type === 'show' ? MediaType.SHOW : undefined;

    const result = await this.statsBackfillService.queueWatchersCountBackfill({
      type: mediaType,
      limit: query.limit,
      minTotalWatchers: query.minTotalWatchers,
    });

    return {
      message:
        result.total === 0
          ? 'No corrupted items found'
          : `Queued ${result.chunksQueued} backfill jobs for ${result.total} items`,
      ...result,
    };
  }

  // === SCORE RECALCULATION ===

  /**
   * Recalculates scores for all media items.
   * Used after changes to scoring logic (e.g., freshness formula).
   */
  @Post('recalculate')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiTags('Service: Stats')
  @ApiOperation({
    summary: 'Recalculate scores for all media items',
    description:
      'Recalculates ratingo_score, quality_score, popularity_score, and freshness_score for all items. Use type=show to recalculate only shows.',
  })
  async recalculateScores(@Query() query: RecalculateScoresQueryDto) {
    const mediaType =
      query.type === 'movie' ? MediaType.MOVIE : query.type === 'show' ? MediaType.SHOW : undefined;

    const result = await this.scoreRecalculationService.recalculateScores({
      type: mediaType,
      batchSize: query.batchSize,
    });

    return {
      message: `Score recalculation complete`,
      total: result.total,
    };
  }
}
