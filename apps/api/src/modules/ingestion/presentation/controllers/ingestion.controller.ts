import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { SyncMediaService } from '../../application/services/sync-media.service';
import { DEFAULT_REGION } from '../../../../common/constants';
import { Inject } from '@nestjs/common';
import {
  MEDIA_REPOSITORY,
  IMediaRepository,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import slugify from 'slugify';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { ApiOkResponse } from '@nestjs/swagger';

class SyncDto {
  @ApiProperty({ example: 550, description: 'TMDB ID of the media' })
  @IsNumber()
  @Min(1)
  tmdbId: number;

  @ApiProperty({ enum: MediaType, example: MediaType.MOVIE })
  @IsEnum(MediaType)
  type: MediaType;

  @ApiProperty({
    example: false,
    description: 'Force re-sync even if media already exists',
    required: false,
    default: false,
  })
  @IsOptional()
  force?: boolean;
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
 * Triggers ingestion processes.
 * Intended for admin panels and operational debugging.
 */
@ApiTags('Service: Ingestion')
@Controller('ingestion')
export class IngestionController {
  private static readonly bullStateToPublicStatus: Record<
    string,
    'queued' | 'processing' | 'ready' | 'failed'
  > = {
    waiting: 'queued',
    delayed: 'queued',
    active: 'processing',
    completed: 'ready',
    failed: 'failed',
    paused: 'queued',
    stalled: 'failed',
  };

  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
    private readonly syncService: SyncMediaService,
    @Inject(MEDIA_REPOSITORY) private readonly mediaRepository: IMediaRepository,
    private readonly tmdbAdapter: TmdbAdapter,
  ) {}

  /**
   * Gets ingestion job status.
   *
   * @param {string} id - Job identifier
   * @returns {Promise<{ id: string; status: string; errorMessage: string | null; updatedAt: string | null }>} Job status payload
   * @throws {NotFoundException} When job does not exist
   */
  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get ingestion job status' })
  @ApiOkResponse({
    description: 'Ingestion job status',
    schema: {
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['queued', 'processing', 'ready', 'failed'] },
        errorMessage: { type: 'string', nullable: true },
        updatedAt: { type: 'string', format: 'date-time', nullable: true },
        slug: {
          type: 'string',
          nullable: true,
          description: 'Media slug (available when status is ready)',
        },
      },
    },
  })
  async getJobStatus(@Param('id') id: string) {
    const job = await this.ingestionQueue.getJob(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const status =
      IngestionController.bullStateToPublicStatus[state] ??
      IngestionController.bullStateToPublicStatus[job.finishedOn ? 'completed' : 'failed'] ??
      'failed';

    const updatedAt =
      (job.finishedOn ?? job.processedOn ?? job.timestamp)
        ? new Date(job.finishedOn ?? job.processedOn ?? job.timestamp)
        : null;

    // Get slug from DB if job is completed and has tmdbId
    let slug: string | null = null;
    if (status === 'ready' && job.data?.tmdbId) {
      const media = await this.mediaRepository.findByTmdbId(job.data.tmdbId);
      slug = media?.slug ?? null;
    }

    return {
      id: `${job.id}`,
      status,
      errorMessage: job.failedReason ?? null,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
      slug,
    };
  }

  /**
   * Queues ingestion sync for a specific TMDB item.
   *
   * @param {SyncDto} dto - Sync payload
   * @returns {Promise<any>} Queueing result
   */
  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger sync for a specific media item' })
  @HttpCode(HttpStatus.ACCEPTED)
  async sync(@Body() dto: SyncDto) {
    // Check if already in DB
    const existing = await this.mediaRepository.findByTmdbId(dto.tmdbId);
    if (existing && !dto.force) {
      return {
        id: existing.id,
        type: existing.type,
        slug: existing.slug,
        ingestionStatus: existing.ingestionStatus,
        status: 'exists',
      };
    }

    // Build stub
    const title =
      dto.type === MediaType.MOVIE
        ? (await this.tmdbAdapter.getMovie(dto.tmdbId))?.title
        : (await this.tmdbAdapter.getShow(dto.tmdbId))?.title;
    const slug = slugify(title || `tmdb-${dto.tmdbId}`, {
      lower: true,
      strict: true,
      locale: 'uk',
    });

    const stub = await this.mediaRepository.upsertStub({
      tmdbId: dto.tmdbId,
      type: dto.type,
      title: title || `TMDB #${dto.tmdbId}`,
      slug,
      ingestionStatus: IngestionStatus.IMPORTING,
    });

    const jobName = dto.type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW;

    const job = await this.ingestionQueue.add(jobName, {
      tmdbId: dto.tmdbId,
    });

    return {
      status: 'queued',
      jobId: `${job.id}`,
      tmdbId: dto.tmdbId,
      id: stub.id,
      slug: stub.slug,
      type: dto.type,
      ingestionStatus: IngestionStatus.IMPORTING,
    };
  }

  /**
   * Queues full trending sync job.
   *
   * @param {SyncTrendingDto} dto - Trending sync payload
   * @returns {Promise<any>} Queueing result with jobId
   */
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

  /**
   * Queues now playing movies ingestion job.
   *
   * @param {SyncNowPlayingDto} dto - Now playing payload
   * @returns {Promise<any>} Queueing result with jobId
   */
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

  /**
   * Queues now playing flags update job.
   *
   * @param {SyncNowPlayingDto} dto - Region payload
   * @returns {Promise<any>} Queueing result with jobId
   */
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

  /**
   * Queues new movie releases ingestion job.
   *
   * @param {SyncNewReleasesDto} dto - New releases payload
   * @returns {Promise<any>} Queueing result with jobId
   */
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

  /**
   * Queues daily snapshots sync job.
   *
   * @returns {Promise<any>} Queueing result with jobId
   */
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

  /**
   * Queues tracked shows sync job.
   * Syncs shows that have active subscriptions (new_season, new_episode triggers).
   *
   * @returns {Promise<any>} Queueing result with jobId
   */
  @Post('shows/tracked')
  @ApiOperation({
    summary: 'Trigger tracked shows sync',
    description:
      'Syncs shows that have active subscriptions. Detects new episodes/seasons and triggers notifications.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncTrackedShows() {
    const job = await this.ingestionQueue.add(IngestionJob.SYNC_TRACKED_SHOWS, {});

    return {
      status: 'queued',
      jobId: job.id,
    };
  }
}
