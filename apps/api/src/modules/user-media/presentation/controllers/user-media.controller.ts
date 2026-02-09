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

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { UserMediaService } from '../../application/user-media.service';
import { BatchRatingsQueryDto, BatchRatingsResponseDto } from '../dto/batch-ratings.dto';
import { SetUserMediaStateDto } from '../dto/set-user-media-state.dto';
import { UserMediaStateDto } from '../dto/user-media-state.dto';

/**
 * Controller for user-specific media state.
 */
@ApiTags('User Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-media')
export class UserMediaController {
  constructor(private readonly userMediaService: UserMediaService) {}

  /**
   * Batch-fetches user ratings for multiple media items.
   *
   * Returns only items that have a non-null rating.
   *
   * @param {{ id: string }} user - Current user context
   * @param {BatchRatingsQueryDto} query - Comma-separated media item IDs
   * @returns {Promise<BatchRatingsResponseDto>} Map of mediaItemId → rating
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
   * Lists "Continue" items for the current user.
   *
   * Returns only items that have `progress` set (i.e. user can resume watching).
   *
   * @param {{ id: string }} user - Current user context
   * @param {number} limit - Page size (default 20)
   * @param {number} offset - Offset (default 0)
   * @returns {Promise<UserMediaStateDto[]>} Continue items with media summary
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
   * Gets state for a media item.
   *
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<any>} State with media summary
   */
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ description: 'User media state', type: UserMediaStateDto, isArray: false })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Get user media state with media summary (auth: Bearer)' })
  @Get(':mediaItemId')
  async getState(@CurrentUser() user: { id: string }, @Param('mediaItemId') mediaItemId: string) {
    return this.userMediaService.getStateWithMedia(user.id, mediaItemId);
  }

  /**
   * Sets state for a media item (upsert).
   *
   * When setState returns null (e.g. clearing a rating that never existed),
   * falls back to fetching the current state. Returns null when no state exists at all.
   *
   * @param {string} mediaItemId - Media item identifier
   * @param {SetUserMediaStateDto} body - Upsert payload
   * @returns {Promise<any>} Updated state with media summary
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

  /**
   * Lists user media states (paged).
   *
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<any[]>} List of states with media summary
   */
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

  /**
   * Pauses a media item.
   *
   * Changes state from 'watching' to 'paused'.
   *
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<any>} Updated state with media summary
   */
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

  /**
   * Resumes a paused media item.
   *
   * Changes state from 'paused' to 'watching'.
   *
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<any>} Updated state with media summary
   */
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
}
