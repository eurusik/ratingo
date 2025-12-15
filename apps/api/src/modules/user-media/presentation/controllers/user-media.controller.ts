import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserMediaService } from '../../application/user-media.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
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
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    const parsedLimit = Number(limit) || 20;
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
    await this.userMediaService.setState({
      userId: user.id,
      mediaItemId,
      state: body.state,
      rating: body.rating ?? null,
      progress: body.progress ?? null,
      notes: body.notes ?? null,
    });

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
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    const parsedLimit = Number(limit) || 20;
    const parsedOffset = Number(offset) || 0;
    return this.userMediaService.listWithMedia(user.id, parsedLimit, parsedOffset);
  }
}
