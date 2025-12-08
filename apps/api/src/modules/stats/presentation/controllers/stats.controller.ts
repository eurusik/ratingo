import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StatsService } from '../../application/services/stats.service';
import { STATS_QUEUE, STATS_JOBS } from '../../stats.constants';

/**
 * REST controller for media statistics endpoints.
 * Provides endpoints for syncing and retrieving real-time stats from Trakt.
 */
@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    @InjectQueue(STATS_QUEUE) private readonly statsQueue: Queue,
  ) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Sync trending stats from Trakt',
    description: 'Adds a job to the queue to fetch current watchers count and trending rank from Trakt API.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items to sync (default: 20)' })
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
  @ApiOperation({
    summary: 'Get stats by TMDB ID',
    description: 'Returns current watchers count and trending rank for a media item.',
  })
  @ApiParam({ name: 'tmdbId', type: Number, description: 'TMDB ID of the media item' })
  async getStatsByTmdbId(@Param('tmdbId') tmdbId: number) {
    return this.statsService.getStatsByTmdbId(tmdbId);
  }
}
