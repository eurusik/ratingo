import { InjectQueue } from '@nestjs/bullmq';
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

import { type Queue } from 'bullmq';

import { formatUtcDayId } from '@/common/utils/date.util';

import { DEFAULT_REGION, CATALOG_DEFAULT_NEW_RELEASE_DAYS } from '../../../../common/constants';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { JOB_STATUS } from '../../../../common/enums/job-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { mapBullStateToJobStatus } from '../../../../common/infrastructure/bullmq/job-status-mapper';
import { AdminJwtGuard } from '../../../auth/public';
import { normalizeRegion, formatHourWindow } from '../../application/helpers/queue.helpers';
import { SyncMediaService } from '../../application/services/sync-media.service';
import {
  INGESTION_QUEUE,
  IngestionJob,
  TRENDING_DEFAULT_PAGES,
  TMDB_TRENDING_PAGE_SIZE,
} from '../../ingestion.constants';
import {
  IngestionJobResponseDto,
  SyncDto,
  SyncTrendingDto,
  SyncTrendingQueryDto,
  SyncNowPlayingDto,
  SyncNewReleasesDto,
} from '../dto';

/**
 * Triggers ingestion processes.
 * Intended for admin panels and operational debugging.
 */
@ApiTags('Admin: Ingestion')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('ingestion')
export class IngestionController {
  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
    private readonly syncService: SyncMediaService,
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
    const status = mapBullStateToJobStatus(state, job.finishedOn);

    const updatedAt =
      (job.finishedOn ?? job.processedOn ?? job.timestamp)
        ? new Date(job.finishedOn ?? job.processedOn ?? job.timestamp)
        : null;

    // Get slug from DB if job is completed and has tmdbId
    let slug: string | null = null;
    if (status === JOB_STATUS.READY && job.data?.tmdbId) {
      slug = await this.syncService.getSlugByTmdbId(job.data.tmdbId);
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
    const existing = await this.syncService.findExistingMedia(dto.tmdbId);
    if (existing && !dto.force) {
      return {
        id: existing.id,
        type: existing.type,
        slug: existing.slug,
        ingestionStatus: existing.ingestionStatus,
        status: 'exists',
      };
    }

    // Create stub for ingestion
    const stub = await this.syncService.createStubForIngestion(dto.tmdbId, dto.type);

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
  @ApiQuery({
    name: 'page',
    required: false,
    type: String,
    description: 'Single page number (legacy mode)',
  })
  @ApiQuery({
    name: 'syncStats',
    required: false,
    type: String,
    description: 'Sync Trakt stats after ingestion (default: true)',
  })
  @ApiQuery({ name: 'force', required: false, type: String, description: 'Bypass dedupe' })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncTrending(
    @Query() query: SyncTrendingQueryDto,
    @Query('page') pageQuery?: string,
    @Query('syncStats') syncStatsQuery?: string,
    @Query('force') forceQuery?: string,
    @Body() dto?: SyncTrendingDto,
  ) {
    const pages = query.pages ?? dto?.pages;
    const page = pageQuery ? parseInt(pageQuery, 10) : dto?.page;
    const syncStats = syncStatsQuery !== 'false' && dto?.syncStats !== false; // default true
    const type = query.type ?? dto?.type;
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
    const pagesCount = pages || TRENDING_DEFAULT_PAGES;
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
      maxItems: pagesCount * TMDB_TRENDING_PAGE_SIZE * 2, // pages × 20 items × 2 types (upper bound)
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
    const daysBack = dto.daysBack || CATALOG_DEFAULT_NEW_RELEASE_DAYS;
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
  @ApiQuery({
    name: 'region',
    required: false,
    type: String,
    description: 'Region code for snapshots',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    type: String,
    description: 'Bypass daily deduplication',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncSnapshots(@Query('region') region?: string, @Query('force') force?: string) {
    const normalizedRegionValue = normalizeRegion(region);

    const isForce = force === 'true';
    const dayId = formatUtcDayId();
    const window = isForce ? Date.now().toString() : dayId;
    const jobId = `snapshots_${normalizedRegionValue}_${window}`;

    const job = await this.ingestionQueue.add(
      IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
      {
        region: normalizedRegionValue,
      },
      { jobId },
    );

    return {
      status: 'queued',
      jobId: job.id,
      jobType: IngestionJob.SYNC_SNAPSHOTS_DISPATCHER,
      region: normalizedRegionValue,
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
  @ApiQuery({
    name: 'force',
    required: false,
    type: String,
    description: 'Bypass hourly deduplication',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async syncTrackedShows(@Query('force') force?: string) {
    const isForce = force === 'true';
    const startedAt = new Date();
    const window = isForce ? startedAt.getTime().toString() : formatHourWindow(startedAt);
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

  /**
   * Queues re-sync job for shows missing IMDb ID.
   * Performs full re-sync: fetches external_ids from TMDB, then enriches with
   * Trakt stats and OMDb ratings (IMDb, Rotten Tomatoes, Metacritic).
   *
   * @returns {Promise<any>} Queueing result with jobId
   */
  @Post('backfill/imdb')
  @ApiOperation({
    summary: 'Re-sync shows missing IMDb ID',
    description:
      'Finds all shows with missing IMDb ID and performs full re-sync. ' +
      'This fetches external_ids from TMDB (including imdb_id), then enriches each show with ' +
      'Trakt stats (watchers, ratings) and OMDb ratings (IMDb, Rotten Tomatoes, Metacritic). ' +
      'Use when shows were imported before external_ids fetching was implemented.',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    type: String,
    description: 'Bypass daily deduplication',
  })
  @ApiOkResponse({ type: IngestionJobResponseDto, description: 'Backfill job queued' })
  @HttpCode(HttpStatus.ACCEPTED)
  async backfillImdb(@Query('force') force?: string) {
    const isForce = force === 'true';
    const today = formatUtcDayId();
    const window = isForce ? Date.now().toString() : today;
    const jobId = `backfill_imdb_${window}`;

    const job = await this.ingestionQueue.add(IngestionJob.BACKFILL_IMDB_DISPATCHER, {}, { jobId });

    return {
      status: 'queued',
      jobId: job.id,
      jobType: IngestionJob.BACKFILL_IMDB_DISPATCHER,
      force: isForce,
    };
  }

  /**
   * Queues backfill job for items missing alternative titles.
   * Uses lightweight TMDB endpoints (no Trakt/OMDb/TVMaze calls).
   */
  @Post('backfill/alt-titles')
  @ApiOperation({
    summary: 'Backfill alternative titles from TMDB',
    description:
      'Finds all media items with missing alternative titles and fetches them from TMDB. ' +
      'Uses dedicated lightweight TMDB endpoints — no Trakt, OMDb, or TVMaze calls. ' +
      'One-time operation; future syncs populate alt titles automatically.',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    type: String,
    description: 'Re-fetch alt titles for items that already have them',
  })
  @ApiOkResponse({ type: IngestionJobResponseDto, description: 'Backfill job queued' })
  @HttpCode(HttpStatus.ACCEPTED)
  async backfillAltTitles(@Query('force') force?: string) {
    const isForce = force === 'true';
    const today = formatUtcDayId();
    const window = isForce ? Date.now().toString() : today;
    const jobId = `backfill_alt_titles_${window}`;

    const job = await this.ingestionQueue.add(
      IngestionJob.BACKFILL_ALT_TITLES_DISPATCHER,
      {},
      { jobId },
    );

    return {
      status: 'queued',
      jobId: job.id,
      jobType: IngestionJob.BACKFILL_ALT_TITLES_DISPATCHER,
      force: isForce,
    };
  }

  /**
   * Queues backfill job for items missing Rotten Tomatoes ratings.
   * Fetches RT critics + audience scores from MDBList for items where
   * OMDb returned null.
   */
  @Post('backfill/mdblist-ratings')
  @ApiOperation({
    summary: 'Backfill Rotten Tomatoes ratings from MDBList (admin-only)',
    description:
      'Admin-only. Finds media items where either Rotten Tomatoes critics score ' +
      'or audience score is missing, or whose last MDBList check is older than the ' +
      'refresh window (rtFetchedAt > 90 days), and fetches critics + audience ' +
      'ratings from MDBList. Complements OMDb, which frequently omits RT values. ' +
      'Item jobs run on a dedicated rate-limited queue; dispatcher enforces an ' +
      'app-side daily cap of 900 items per run to fit the MDBList free-tier ' +
      'budget (1000 req/day; worker limiter ~40/hour).',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    type: String,
    description: 'Bypass daily deduplication (allows re-running within the same UTC day)',
  })
  @ApiOkResponse({ type: IngestionJobResponseDto, description: 'Backfill job queued' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Authenticated user does not have admin role' })
  @HttpCode(HttpStatus.ACCEPTED)
  async backfillMdblistRatings(@Query('force') force?: string) {
    const isForce = force === 'true';
    const today = formatUtcDayId();
    const window = isForce ? Date.now().toString() : today;
    const jobId = `backfill_mdblist_ratings_${window}`;

    const job = await this.ingestionQueue.add(
      IngestionJob.BACKFILL_MDBLIST_RATINGS_DISPATCHER,
      {},
      { jobId },
    );

    return {
      status: 'queued',
      jobId: job.id,
      jobType: IngestionJob.BACKFILL_MDBLIST_RATINGS_DISPATCHER,
      force: isForce,
    };
  }

  /**
   * Queues a backfill job that populates the persons / media_credits read-model
   * from existing media_items.credits JSONB. One-time operation; future syncs
   * populate the read-model automatically.
   */
  @Post('backfill/person-credits')
  @ApiOperation({
    summary: 'Backfill person credits read-model from existing credits',
    description:
      'Finds media items whose credits JSONB contains cast/crew and queues per-item jobs ' +
      'that upsert persons and rebuild media_credits rows. Pure DB work — no external API calls.',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    type: String,
    description: 'Bypass daily deduplication',
  })
  @ApiOkResponse({ type: IngestionJobResponseDto, description: 'Backfill job queued' })
  @HttpCode(HttpStatus.ACCEPTED)
  async backfillPersonCredits(@Query('force') force?: string) {
    const isForce = force === 'true';
    const today = formatUtcDayId();
    const window = isForce ? Date.now().toString() : today;
    const jobId = `backfill_person_credits_${window}`;

    const job = await this.ingestionQueue.add(
      IngestionJob.BACKFILL_PERSON_CREDITS_DISPATCHER,
      {},
      { jobId },
    );

    return {
      status: 'queued',
      jobId: job.id,
      jobType: IngestionJob.BACKFILL_PERSON_CREDITS_DISPATCHER,
      force: isForce,
    };
  }
}
