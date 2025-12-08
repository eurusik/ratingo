import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '@/common/enums/media-type.enum';
import { SyncMediaService } from '../../application/services/sync-media.service';

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

  @ApiProperty({ example: true, description: 'Also sync Trakt stats after ingestion', default: true, required: false })
  @IsOptional()
  syncStats?: boolean;
}

class SyncNowPlayingDto {
  @ApiProperty({ example: 'UA', description: 'Region code (ISO 3166-1)', default: 'UA', required: false })
  @IsOptional()
  region?: string;
}

class SyncNewReleasesDto {
  @ApiProperty({ example: 'UA', description: 'Region code (ISO 3166-1)', default: 'UA', required: false })
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
@ApiTags('ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
    private readonly syncService: SyncMediaService,
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
    description: 'Syncs trending content from TMDB. With syncStats=true (default), also updates Trakt stats after ingestion.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncTrending(@Body() dto: SyncTrendingDto) {
    const page = dto.page || 1;
    const syncStats = dto.syncStats !== false; // default true

    // Queue full trending sync job (ingestion + stats)
    const job = await this.ingestionQueue.add(IngestionJob.SYNC_TRENDING_FULL, {
      page,
      syncStats,
    });

    return { 
      status: 'queued', 
      jobId: job.id,
      page,
      syncStats,
    };
  }

  @Post('now-playing')
  @ApiOperation({ 
    summary: 'Sync movies currently in theaters',
    description: 'Fetches now playing movies from TMDB and syncs them to the database. Updates isNowPlaying flags.',
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

  @Post('new-releases')
  @ApiOperation({ 
    summary: 'Sync new theatrical releases',
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
}
