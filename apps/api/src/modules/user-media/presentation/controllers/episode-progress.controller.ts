import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../../auth/public';
import { JwtAuthGuard } from '../../../auth/public';
import { EpisodeProgressService } from '../../application/episode-progress.service';
import { BatchEpisodeIdsDto } from '../dto/batch-episode-ids.dto';
import { ShowProgressDto } from '../dto/episode-progress.dto';

@ApiTags('Episode Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-media')
export class EpisodeProgressController {
  constructor(private readonly episodeProgressService: EpisodeProgressService) {}

  @ApiBody({ type: BatchEpisodeIdsDto })
  @ApiNoContentResponse({ description: 'Episodes marked as watched' })
  @ApiNotFoundResponse({ description: 'First episode not found' })
  @ApiBadRequestResponse({ description: 'Invalid episode IDs or episodes from different shows' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Batch mark episodes as watched (auth: Bearer)' })
  @Post('episodes/batch/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markBatchWatched(
    @CurrentUser() user: { id: string },
    @Body() body: BatchEpisodeIdsDto,
  ): Promise<void> {
    await this.episodeProgressService.markBatchWatched(user.id, body.episodeIds);
  }

  @ApiBody({ type: BatchEpisodeIdsDto })
  @ApiNoContentResponse({ description: 'Episodes marked as unwatched' })
  @ApiNotFoundResponse({ description: 'First episode not found' })
  @ApiBadRequestResponse({ description: 'Invalid episode IDs or episodes from different shows' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Batch mark episodes as unwatched (auth: Bearer)' })
  @Post('episodes/batch/unwatch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markBatchUnwatched(
    @CurrentUser() user: { id: string },
    @Body() body: BatchEpisodeIdsDto,
  ): Promise<void> {
    await this.episodeProgressService.markBatchUnwatched(user.id, body.episodeIds);
  }

  @ApiParam({ name: 'episodeId', type: String, description: 'Episode UUID' })
  @ApiNoContentResponse({ description: 'Episode marked as watched' })
  @ApiNotFoundResponse({ description: 'Episode not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Mark episode as watched (auth: Bearer)' })
  @Post('episodes/:episodeId/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markWatched(
    @CurrentUser() user: { id: string },
    @Param('episodeId') episodeId: string,
  ): Promise<void> {
    await this.episodeProgressService.markWatched(user.id, episodeId);
  }

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
    await this.episodeProgressService.markUnwatched(user.id, episodeId);
  }

  @ApiParam({ name: 'showId', type: String, description: 'Show UUID' })
  @ApiOkResponse({ description: 'Show progress', type: ShowProgressDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Get watch progress for a show (auth: Bearer)' })
  @Get('shows/:showId/progress')
  async getShowProgress(
    @CurrentUser() user: { id: string },
    @Param('showId') showId: string,
  ): Promise<ShowProgressDto> {
    const seasons = await this.episodeProgressService.getShowProgress(user.id, showId);
    return {
      showId,
      seasons,
    };
  }
}
