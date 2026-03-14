import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { ImportMediaService } from '../../application/import-media.service';
import { ImportPendingService } from '../../application/import-pending.service';
import { UserMediaService } from '../../application/user-media.service';
import { normalizeKinobazaRating } from '../../domain/value-objects/external-rating';
import { BatchRatingsQueryDto, BatchRatingsResponseDto } from '../dto/batch-ratings.dto';
import { ImportBatchStatusDto } from '../dto/import-batch-status.dto';
import { CsvImportResultDto, ImportMediaDto } from '../dto/import-media.dto';
import { SetUserMediaStateDto } from '../dto/set-user-media-state.dto';
import { UserMediaStateDto } from '../dto/user-media-state.dto';

@ApiTags('User Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-media')
export class UserMediaController {
  constructor(
    private readonly userMediaService: UserMediaService,
    private readonly importMediaService: ImportMediaService,
    private readonly importPendingService: ImportPendingService,
  ) {}

  /**
   * Returns only items that have a non-null rating.
   */
  @ApiOkResponse({ description: 'Batch ratings', type: BatchRatingsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUIDs or empty list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Batch fetch user ratings (auth: Bearer)' })
  @Get('batch-ratings')
  async batchRatings(
    @CurrentUser() user: { id: string },
    @Query() query: BatchRatingsQueryDto,
  ): Promise<BatchRatingsResponseDto> {
    const states = await this.userMediaService.findMany(user.id, query.ids);

    const ratings: Record<string, number> = {};
    for (const state of states) {
      if (state.rating != null) {
        ratings[state.mediaItemId] = state.rating;
      }
    }

    return { ratings };
  }

  /**
   * Returns only items that have `progress` set (i.e. user can resume watching).
   */
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset (default 0)' })
  @ApiOkResponse({ description: 'Continue items', type: UserMediaStateDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'List continue items with media summary (auth: Bearer)' })
  @Get('continue')
  async listContinue(
    @CurrentUser() user: { id: string },
    @Query('limit') limit = DEFAULT_PAGE_SIZE,
    @Query('offset') offset = 0,
  ) {
    const parsedLimit = Number(limit) || DEFAULT_PAGE_SIZE;
    const parsedOffset = Number(offset) || 0;
    return this.userMediaService.listContinueWithMedia(user.id, parsedLimit, parsedOffset);
  }

  /**
   * Returns the most recent auto-ingest batch statuses for the authenticated user.
   * Poll this endpoint (e.g. every 5 seconds) while any batch is in 'processing' status.
   */
  @ApiOkResponse({
    description: 'Import batch statuses',
    type: ImportBatchStatusDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Get auto-ingest import batch statuses (auth: Bearer)' })
  @Get('import/status')
  async getImportStatus(@CurrentUser() user: { id: string }): Promise<ImportBatchStatusDto[]> {
    const batches = await this.importPendingService.getUserBatches(user.id);
    return batches.map((batch) => ({
      batchId: batch.id,
      source: batch.source,
      totalItems: batch.totalItems,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      status: batch.status,
      createdAt: batch.createdAt.toISOString(),
    }));
  }

  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ description: 'User media state', type: UserMediaStateDto, isArray: false })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Get user media state with media summary (auth: Bearer)' })
  @Get(':mediaItemId')
  async getState(@CurrentUser() user: { id: string }, @Param('mediaItemId') mediaItemId: string) {
    return this.userMediaService.getStateWithMedia(user.id, mediaItemId);
  }

  /**
   * When setState returns null (e.g. clearing a rating that never existed),
   * falls back to fetching the current state. Returns null when no state exists at all.
   */
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiBody({ type: SetUserMediaStateDto })
  @ApiOkResponse({ description: 'Upserted user media state', type: UserMediaStateDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Upsert user media state with media summary (auth: Bearer)' })
  @Patch(':mediaItemId')
  @HttpCode(HttpStatus.OK)
  async setState(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
    @Body() body: SetUserMediaStateDto,
  ) {
    await this.userMediaService.setState(
      {
        userId: user.id,
        mediaItemId,
        ...(body.state !== undefined && { state: body.state }),
        ...(body.rating !== undefined && { rating: body.rating }),
        ...(body.progress !== undefined && { progress: body.progress }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      body.mediaType,
    );

    return this.userMediaService.getStateWithMedia(user.id, mediaItemId);
  }

  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset (default 0)' })
  @ApiOkResponse({ description: 'User media states', type: UserMediaStateDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'List user media states with media summary (auth: Bearer)' })
  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('limit') limit = DEFAULT_PAGE_SIZE,
    @Query('offset') offset = 0,
  ) {
    const parsedLimit = Number(limit) || DEFAULT_PAGE_SIZE;
    const parsedOffset = Number(offset) || 0;
    return this.userMediaService.listWithMedia(user.id, parsedLimit, parsedOffset);
  }

  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ description: 'Media item paused', type: UserMediaStateDto })
  @ApiBadRequestResponse({ description: 'Cannot pause: item is not currently being watched' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Pause a media item (auth: Bearer)' })
  @Post(':mediaItemId/pause')
  @HttpCode(HttpStatus.OK)
  async pauseMedia(@CurrentUser() user: { id: string }, @Param('mediaItemId') mediaItemId: string) {
    await this.userMediaService.pauseMedia(user.id, mediaItemId);
    return this.userMediaService.getStateWithMedia(user.id, mediaItemId);
  }

  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ description: 'Media item resumed', type: UserMediaStateDto })
  @ApiBadRequestResponse({ description: 'Cannot resume: item is not paused' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Resume a paused media item (auth: Bearer)' })
  @Post(':mediaItemId/resume')
  @HttpCode(HttpStatus.OK)
  async resumeMedia(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
  ) {
    await this.userMediaService.resumeMedia(user.id, mediaItemId);
    return this.userMediaService.getStateWithMedia(user.id, mediaItemId);
  }

  /**
   * Matching is done by IMDB ID first (unambiguous), then TMDB ID fallback.
   * Existing entries are skipped by default; set `overwriteExisting: true` to update them.
   * State can never be downgraded (e.g. completed cannot be overwritten with planned).
   */
  @ApiBody({ type: ImportMediaDto })
  @ApiOkResponse({ description: 'Import result', type: CsvImportResultDto })
  @ApiBadRequestResponse({ description: 'Invalid request body or source' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Import ratings and watchlist from external source (auth: Bearer)' })
  @Throttle({ strict: { limit: 3, ttl: 60000 } })
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importMedia(
    @CurrentUser() user: { id: string },
    @Body() body: ImportMediaDto,
  ): Promise<CsvImportResultDto> {
    return this.importMediaService.import({
      userId: user.id,
      source: body.source,
      items: body.items.map((item) => ({
        imdbId: item.imdbId,
        tmdbId: item.tmdbId,
        rating: item.rating != null ? normalizeKinobazaRating(item.rating) : null,
        state: item.state,
        title: item.title,
        year: item.year,
      })),
      overwriteExisting: body.overwriteExisting ?? false,
    });
  }
}
