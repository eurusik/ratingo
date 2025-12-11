import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { SyncMediaService } from '../../application/services/sync-media.service';
import { DEFAULT_REGION } from '../../../../common/constants';

class SyncDto {
  @ApiProperty({ example: 550, description: 'TMDB ID of the media' })
  @IsNumber()
  @Min(1)
  tmdbId: number;

  @ApiProperty({ enum: MediaType, example: MediaType.MOVIE })
  @IsEnum(MediaType)
  type: MediaType;
}

class SyncTrendingDto {
  @ApiProperty({ example: 1, description: 'Page number', default: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    example: true,
    description: 'Also sync Trakt stats after ingestion',
    default: true,
    required: false,
  })
  @IsOptional()
  syncStats?: boolean;

  @ApiProperty({
    enum: MediaType,
    description: 'Sync only specific media type (movie or show)',
    required: false,
  })
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;
}

class SyncNowPlayingDto {
  @ApiProperty({
    example: DEFAULT_REGION,
    description: 'Region code (ISO 3166-1)',
    default: DEFAULT_REGION,
    required: false,
  })
  @IsOptional()
  region?: string;
}

class SyncNewReleasesDto {
  @ApiProperty({
    example: DEFAULT_REGION,
    description: 'Region code (ISO 3166-1)',
    default: DEFAULT_REGION,
    required: false,
  })
  @IsOptional()
  region?: string;

  @ApiProperty({ example: 30, description: 'Days to look back', default: 30, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  daysBack?: number;
}

/**
 * Controller for triggering ingestion processes manually.
 * Useful for admin panels or debugging.
 */
@ApiTags('Service: Ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
    private readonly syncService: SyncMediaService
  ) {}

  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger sync for a specific media item' })
  @HttpCode(HttpStatus.ACCEPTED)
  async sync(@Body() dto: SyncDto) {
    const jobName = dto.type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW;

    await this.ingestionQueue.add(jobName, {
      tmdbId: dto.tmdbId,
    });

    return { status: 'queued', jobId: jobName, tmdbId: dto.tmdbId };
  }

  @Post('trending')
  @ApiOperation({
    summary: 'Trigger sync for trending movies and shows',
    description:
      'Syncs trending content from TMDB. With syncStats=true (default), also updates Trakt stats after ingestion.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncTrending(@Body() dto: SyncTrendingDto) {
    const page = dto.page || 1;
    const syncStats = dto.syncStats !== false; // default true

    // Queue full trending sync job (ingestion + stats)
    const job = await this.ingestionQueue.add(IngestionJob.SYNC_TRENDING_FULL, {
      page,
      syncStats,
      type: dto.type,
    });

    return {
      status: 'queued',
      jobId: job.id,
      page,
      syncStats,
      type: dto.type,
    };
  }

  @Post('movies/now-playing')
  @ApiOperation({
    summary: 'Sync movies currently in theaters (ingestion only)',
    description:
      'Fetches now playing movies from TMDB and queues them for sync. Does NOT update isNowPlaying flags - use /ingestion/movies/now-playing-flags for that.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncNowPlaying(@Body() dto: SyncNowPlayingDto) {
    const job = await this.ingestionQueue.add(IngestionJob.SYNC_NOW_PLAYING, {
      region: dto.region || 'UA',
    });

    return {
      status: 'queued',
      jobId: job.id,
      region: dto.region || 'UA',
    };
  }

  @Post('movies/now-playing-flags')
  @ApiOperation({
    summary: 'Update isNowPlaying flags for movies',
    description:
      'Updates isNowPlaying flags based on current TMDB now_playing list. Run this AFTER now-playing sync has completed.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async updateNowPlayingFlags(@Body() dto: SyncNowPlayingDto) {
    const job = await this.ingestionQueue.add(IngestionJob.UPDATE_NOW_PLAYING_FLAGS, {
      region: dto.region || 'UA',
    });

    return {
      status: 'queued',
      jobId: job.id,
      region: dto.region || 'UA',
    };
  }

  @Post('movies/new-releases')
  @ApiOperation({
    summary: 'Sync new theatrical movie releases',
    description: 'Fetches movies released in theaters within the specified period and syncs them.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncNewReleases(@Body() dto: SyncNewReleasesDto) {
    const job = await this.ingestionQueue.add(IngestionJob.SYNC_NEW_RELEASES, {
      region: dto.region || 'UA',
      daysBack: dto.daysBack || 30,
    });

    return {
      status: 'queued',
      jobId: job.id,
      region: dto.region || 'UA',
      daysBack: dto.daysBack || 30,
    };
  }

  @Post('snapshots')
  @ApiOperation({
    summary: 'Trigger daily watchers snapshots sync',
    description: 'Updates daily watcher counts for all media items from Trakt.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncSnapshots() {
    const job = await this.ingestionQueue.add(IngestionJob.SYNC_SNAPSHOTS, {});

    return {
      status: 'queued',
      jobId: job.id,
    };
  }
}
