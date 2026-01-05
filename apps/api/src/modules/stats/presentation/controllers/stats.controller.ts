import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';

import { type Queue } from 'bullmq';

import { DEFAULT_BATCH_SIZE, DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import { AdminJwtGuard } from '../../../auth/infrastructure/guards/admin-jwt.guard';
import { DropOffService } from '../../application/services/drop-off.service';
import { StatsService } from '../../application/services/stats.service';
import { STATS_QUEUE, STATS_JOBS } from '../../stats.constants';

/**
 * REST controller for media statistics endpoints.
 * Provides endpoints for syncing and retrieving real-time stats and drop-off analysis.
 */
@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
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
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `Number of items to sync (default: ${DEFAULT_PAGE_SIZE})`,
  })
  async syncTrendingStats(@Query('limit') limit?: number) {
    const job = await this.statsQueue.add(STATS_JOBS.SYNC_TRENDING, {
      limit: limit || DEFAULT_PAGE_SIZE,
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
    return this.statsService.getStatsByTmdbId(tmdbId);
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
  @ApiQuery({
    name: 'tmdbId',
    required: false,
    type: Number,
    description: 'TMDB ID of specific show to analyze',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `Max shows to analyze (default: ${DEFAULT_BATCH_SIZE})`,
  })
  async analyzeDropOff(@Query('tmdbId') tmdbId?: number, @Query('limit') limit?: number) {
    const job = await this.statsQueue.add(STATS_JOBS.ANALYZE_DROP_OFF, {
      tmdbId,
      limit: limit || DEFAULT_BATCH_SIZE,
    });

    return {
      message: tmdbId
        ? `Drop-off analysis job for show ${tmdbId} added to queue`
        : `Drop-off analysis job for ${limit || DEFAULT_BATCH_SIZE} shows added to queue`,
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
}
