import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StatsService } from '../../application/services/stats.service';
import { DropOffService } from '../../application/services/drop-off.service';
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
    @InjectQueue(STATS_QUEUE) private readonly statsQueue: Queue
  ) {}

  @Post('sync')
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
    description: 'Number of items to sync (default: 20)',
  })
  async syncTrendingStats(@Query('limit') limit?: number) {
    const job = await this.statsQueue.add(STATS_JOBS.SYNC_TRENDING, {
      limit: limit || 20,
    });

    return {
      message: 'Stats sync job added to queue',
      jobId: job.id,
    };
  }

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

  @Post('drop-off/analyze')
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
    description: 'Max shows to analyze (default: 50)',
  })
  async analyzeDropOff(@Query('tmdbId') tmdbId?: number, @Query('limit') limit?: number) {
    const job = await this.statsQueue.add(STATS_JOBS.ANALYZE_DROP_OFF, {
      tmdbId,
      limit: limit || 50,
    });

    return {
      message: tmdbId
        ? `Drop-off analysis job for show ${tmdbId} added to queue`
        : `Drop-off analysis job for ${limit || 50} shows added to queue`,
      jobId: job.id,
    };
  }

  @Post('drop-off/analyze/:tmdbId')
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
