import {
  Controller,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { SyncMediaService } from '../../application/services/sync-media.service';
import { DEFAULT_REGION } from '../../../../common/constants';
import {
  MEDIA_REPOSITORY,
  IMediaRepository,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { JobStatus, BULL_STATE_TO_JOB_STATUS } from '../../../../common/enums/job-status.enum';
import slugify from 'slugify';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { formatUtcDayId } from '@/common/utils/date.util';
import { SyncDto, SyncTrendingDto, SyncNowPlayingDto, SyncNewReleasesDto } from '../dto';

/**
 * Triggers ingestion processes.
 * Intended for admin panels and operational debugging.
 */
@ApiTags('Service: Ingestion')
@Controller('ingestion')
export class IngestionController {
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
      BULL_STATE_TO_JOB_STATUS[state] ??
      BULL_STATE_TO_JOB_STATUS[job.finishedOn ? 'completed' : 'failed'] ??
      JobStatus.FAILED;

    const updatedAt =
      (job.finishedOn ?? job.processedOn ?? job.timestamp)
        ? new Date(job.finishedOn ?? job.processedOn ?? job.timestamp)
        : null;

    // Get slug from DB if job is completed and has tmdbId
    let slug: string | null = null;
    if (status === JobStatus.READY && job.data?.tmdbId) {
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
      'Syncs trending content from TMDB using dispatcher pattern. Queues page jobs for movies and shows. With syncStats=true (default), also updates Trakt stats after ingestion.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncTrending(
    @Query('pages') pagesQuery?: string,
    @Query('page') pageQuery?: string,
    @Query('syncStats') syncStatsQuery?: string,
    @Query('type') typeQuery?: string,
    @Query('force') forceQuery?: string,
    @Body() dto?: SyncTrendingDto,
  ) {
    // Merge query params with body (query takes precedence for convenience)
    const pages = pagesQuery ? parseInt(pagesQuery, 10) : dto?.pages;
    const page = pageQuery ? parseInt(pageQuery, 10) : dto?.page;
    const syncStats = syncStatsQuery !== 'false' && dto?.syncStats !== false; // default true
    const type = (typeQuery as MediaType) || dto?.type;
    const force = forceQuery === 'true';

    // Validate: page and pages are mutually exclusive
    if (page && pages) {
      throw new BadRequestException(
        'Cannot specify both "page" and "pages". Use "pages" for dispatcher mode (recommended) or "page" for legacy single-page mode.',
      );
    }

    // Legacy single-page mode (deprecated) - only if page is explicitly set
    if (page) {
      const job = await this.ingestionQueue.add(IngestionJob.SYNC_TRENDING_FULL, {
        page,
        syncStats,
        type,
      });

      return {
        status: 'queued',
        jobId: job.id,
        mode: 'legacy',
        page,
        syncStats,
        type,
      };
    }

    // Dispatcher mode (default and recommended)
    const pagesCount = pages || 5;
    const job = await this.ingestionQueue.add(IngestionJob.SYNC_TRENDING_DISPATCHER, {
      pages: pagesCount,
      syncStats,
      force, // Pass force flag to bypass dedupe
    });

    return {
      status: 'queued',
      jobId: job.id,
      mode: 'dispatcher',
      pages: pagesCount,
      maxItems: pagesCount * 20 * 2, // pages × 20 items × 2 types (upper bound)
      syncStats,
      force,
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
      region: dto.region || DEFAULT_REGION,
    });

    return {
      status: 'queued',
      jobId: job.id,
      region: dto.region || DEFAULT_REGION,
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
      region: dto.region || DEFAULT_REGION,
    });

    return {
      status: 'queued',
      jobId: job.id,
      region: dto.region || DEFAULT_REGION,
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
    const region = dto.region || DEFAULT_REGION;
    const daysBack = dto.daysBack || 30;
    const force = dto.force || false;

    // Deduplication logic: one job per region/daysBack per day
    // jobId: new_releases_UA_30_20231025
    const today = formatUtcDayId();
    const jobId = `new_releases_${region}_${daysBack}_${today}`;

    // If force is true, we don't set jobId so BullMQ creates a new unique ID
    const jobOptions = force ? {} : { jobId };

    const job = await this.ingestionQueue.add(
      IngestionJob.SYNC_NEW_RELEASES,
      {
        region,
        daysBack,
        force,
      },
      jobOptions,
    );

    return {
      status: 'queued',
      jobId: job.id,
      region,
      daysBack,
      force,
      deduped: !force && job.id === jobId,
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
  async syncSnapshots(@Query('region') region?: string, @Query('force') force?: string) {
    const normalizedRegion = (() => {
      if (!region) return 'global';
      if (region.toLowerCase() === 'global') return 'global';
      const sanitized = region.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      return sanitized.length > 0 ? sanitized : 'global';
    })();

    const isForce = force === 'true';
    const dayId = formatUtcDayId();
    const window = isForce ? Date.now().toString() : dayId;
    const jobId = `snapshots_${normalizedRegion}_${window}`;

    const job = await this.ingestionQueue.add(
      IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
      {
        region: normalizedRegion,
      },
      { jobId },
    );

    return {
      status: 'queued',
      jobId: job.id,
      jobType: IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
      region: normalizedRegion,
      force: isForce,
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
  async syncTrackedShows(@Query('force') force?: string) {
    const isForce = force === 'true';
    const startedAt = new Date();
    const window = isForce
      ? startedAt.getTime().toString()
      : startedAt.toISOString().slice(0, 13).replace(/[-T]/g, '');
    const jobId = `tracked_shows_${window}`;

    const job = await this.ingestionQueue.add(
      IngestionJob.SYNC_TRACKED_SHOWS,
      { window },
      { jobId },
    );

    return {
      status: 'queued',
      jobId: job.id,
      jobType: IngestionJob.SYNC_TRACKED_SHOWS,
      window,
      force: isForce,
    };
  }
}
