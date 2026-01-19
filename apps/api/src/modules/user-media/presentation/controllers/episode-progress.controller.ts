import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import {
  EPISODE_PROGRESS_REPOSITORY,
  type IEpisodeProgressRepository,
} from '../../domain/repositories/episode-progress.repository.interface';
import { ShowProgressDto } from '../dto/episode-progress.dto';

/**
 * Controller for episode watch progress tracking.
 */
@ApiTags('Episode Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-media')
export class EpisodeProgressController {
  constructor(
    @Inject(EPISODE_PROGRESS_REPOSITORY)
    private readonly episodeProgressRepository: IEpisodeProgressRepository,
  ) {}

  /**
   * Marks an episode as watched.
   *
   * @param {{ id: string }} user - Current user context
   * @param {string} episodeId - Episode UUID
   * @returns {Promise<void>}
   */
  @ApiParam({ name: 'episodeId', type: String, description: 'Episode UUID' })
  @ApiNoContentResponse({ description: 'Episode marked as watched' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Mark episode as watched (auth: Bearer)' })
  @Post('episodes/:episodeId/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markWatched(
    @CurrentUser() user: { id: string },
    @Param('episodeId') episodeId: string,
  ): Promise<void> {
    await this.episodeProgressRepository.markWatched(user.id, episodeId);
  }

  /**
   * Marks an episode as unwatched.
   *
   * @param {{ id: string }} user - Current user context
   * @param {string} episodeId - Episode UUID
   * @returns {Promise<void>}
   */
  @ApiParam({ name: 'episodeId', type: String, description: 'Episode UUID' })
  @ApiNoContentResponse({ description: 'Episode marked as unwatched' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Mark episode as unwatched (auth: Bearer)' })
  @Delete('episodes/:episodeId/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markUnwatched(
    @CurrentUser() user: { id: string },
    @Param('episodeId') episodeId: string,
  ): Promise<void> {
    await this.episodeProgressRepository.markUnwatched(user.id, episodeId);
  }

  /**
   * Gets progress for all seasons of a show.
   *
   * @param {{ id: string }} user - Current user context
   * @param {string} showId - Show UUID (from shows table)
   * @returns {Promise<ShowProgressDto>} Progress per season
   */
  @ApiParam({ name: 'showId', type: String, description: 'Show UUID' })
  @ApiOkResponse({ description: 'Show progress', type: ShowProgressDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Get watch progress for a show (auth: Bearer)' })
  @Get('shows/:showId/progress')
  async getShowProgress(
    @CurrentUser() user: { id: string },
    @Param('showId') showId: string,
  ): Promise<ShowProgressDto> {
    const seasons = await this.episodeProgressRepository.getShowProgress(user.id, showId);
    return {
      showId,
      seasons,
    };
  }
}
