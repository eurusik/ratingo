import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { type ImageDto } from '../../../../common/dtos/image.dto';
import { type MediaType } from '../../../../common/enums/media-type.enum';
import { CurrentUser } from '../../../auth/public';
import { JwtAuthGuard } from '../../../auth/public';
import { MeListsService } from '../../application/me-lists.service';
import { type UserMediaState } from '../../domain/entities/user-media-state.entity';
import { FavoriteUpdatesResponseDto } from '../dto/favorite-updates.dto';
import {
  MeHistoryListQueryDto,
  MeListCountsResponseDto,
  MeUserMediaListQueryDto,
  type MeUserMediaListItemDto,
  PaginatedMeUserMediaResponseDto,
} from '../dto/me-lists.dto';

type UserMediaWithSummary = UserMediaState & {
  mediaSummary: {
    id: string;
    type: MediaType;
    title: string;
    slug: string;
    poster: ImageDto | null;
    releaseDate?: Date | null;
  };
  progressSummary?: { watched: number; total: number } | null;
};

/**
 * Exposes owner-only user media list endpoints.
 */
@ApiTags('Me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeListsController {
  constructor(private readonly meListsService: MeListsService) {}

  /**
   * Maps repository records to API DTO.
   *
   * @param {UserMediaWithSummary} item - User media state with media summary
   * @returns {MeUserMediaListItemDto} API list item DTO
   */
  private mapItem(item: UserMediaWithSummary): MeUserMediaListItemDto {
    return {
      id: item.id,
      userId: item.userId,
      mediaItemId: item.mediaItemId,
      state: item.state,
      rating: item.rating,
      progress: item.progress,
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      mediaSummary: item.mediaSummary,
      progressSummary: item.progressSummary ?? null,
    };
  }

  /**
   * Gets current user's ratings list.
   *
   * @param {{ id: string }} user - Current user context
   * @param {MeUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedMeUserMediaResponseDto>} Paginated ratings list
   */
  @Get('ratings')
  @ApiOperation({ summary: 'My ratings (auth: Bearer)' })
  @ApiOkResponse({ type: PaginatedMeUserMediaResponseDto })
  async ratings(
    @CurrentUser() user: { id: string },
    @Query() query: MeUserMediaListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getRatings(
      user.id,
      limit,
      offset,
      query.sort,
      query.type,
    );

    const items = (data as UserMediaWithSummary[]).map((i) => this.mapItem(i));

    return {
      data: items,
      meta: {
        count: items.length,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  /**
   * Gets current user's watchlist.
   *
   * @param {{ id: string }} user - Current user context
   * @param {MeUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedMeUserMediaResponseDto>} Paginated watchlist
   */
  @Get('watchlist')
  @ApiOperation({ summary: 'My watchlist (auth: Bearer)' })
  @ApiOkResponse({ type: PaginatedMeUserMediaResponseDto })
  async watchlist(
    @CurrentUser() user: { id: string },
    @Query() query: MeUserMediaListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getWatchlist(
      user.id,
      limit,
      offset,
      query.sort,
      query.type,
    );

    const items = (data as UserMediaWithSummary[]).map((i) => this.mapItem(i));

    return {
      data: items,
      meta: {
        count: items.length,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  /**
   * Gets current user's watch history.
   *
   * @param {{ id: string }} user - Current user context
   * @param {MeUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedMeUserMediaResponseDto>} Paginated watch history
   */
  @Get('history')
  @ApiOperation({ summary: 'My history (auth: Bearer)' })
  @ApiOkResponse({ type: PaginatedMeUserMediaResponseDto })
  async history(
    @CurrentUser() user: { id: string },
    @Query() query: MeHistoryListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getHistory(
      user.id,
      limit,
      offset,
      query.sort,
      query.type,
      query.state,
    );

    const items = (data as UserMediaWithSummary[]).map((i) => this.mapItem(i));

    return {
      data: items,
      meta: {
        count: items.length,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  /**
   * Gets current user's in-progress activity list.
   *
   * @param {{ id: string }} user - Current user context
   * @param {MeUserMediaListQueryDto} query - Pagination query
   * @returns {Promise<PaginatedMeUserMediaResponseDto>} Paginated activity list
   */
  @Get('activity')
  @ApiOperation({ summary: 'My activity (auth: Bearer)' })
  @ApiOkResponse({ type: PaginatedMeUserMediaResponseDto })
  async activity(
    @CurrentUser() user: { id: string },
    @Query() query: MeUserMediaListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getActivity(
      user.id,
      limit,
      offset,
      query.type,
    );

    const items = (data as UserMediaWithSummary[]).map((i) => this.mapItem(i));

    return {
      data: items,
      meta: {
        count: items.length,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  /**
   * Gets current user's paused items.
   *
   * @param {{ id: string }} user - Current user context
   * @param {MeUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedMeUserMediaResponseDto>} Paginated paused items list
   */
  @Get('paused')
  @ApiOperation({ summary: 'My paused items (auth: Bearer)' })
  @ApiOkResponse({ type: PaginatedMeUserMediaResponseDto })
  async paused(
    @CurrentUser() user: { id: string },
    @Query() query: MeUserMediaListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getPaused(
      user.id,
      limit,
      offset,
      query.sort,
      query.type,
    );

    const items = (data as UserMediaWithSummary[]).map((i) => this.mapItem(i));

    return {
      data: items,
      meta: {
        count: items.length,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  /**
   * Gets current user's caught-up items (ongoing shows with all aired episodes watched).
   */
  @Get('caught-up')
  @ApiOperation({ summary: 'My caught-up items (auth: Bearer)' })
  @ApiOkResponse({ type: PaginatedMeUserMediaResponseDto })
  async caughtUp(
    @CurrentUser() user: { id: string },
    @Query() query: MeUserMediaListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getCaughtUp(
      user.id,
      limit,
      offset,
      query.sort,
      query.type,
    );

    const items = (data as UserMediaWithSummary[]).map((i) => this.mapItem(i));

    return {
      data: items,
      meta: {
        count: items.length,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  /**
   * Gets current user's dropped items.
   *
   * @param {{ id: string }} user - Current user context
   * @param {MeUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedMeUserMediaResponseDto>} Paginated dropped items list
   */
  @Get('dropped')
  @ApiOperation({ summary: 'My dropped items (auth: Bearer)' })
  @ApiOkResponse({ type: PaginatedMeUserMediaResponseDto })
  async dropped(
    @CurrentUser() user: { id: string },
    @Query() query: MeUserMediaListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getDropped(
      user.id,
      limit,
      offset,
      query.sort,
      query.type,
    );

    const items = (data as UserMediaWithSummary[]).map((i) => this.mapItem(i));

    return {
      data: items,
      meta: {
        count: items.length,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    };
  }

  /**
   * Gets aggregated counts for all user lists (activity + saved).
   *
   * Single lightweight endpoint that replaces 6 full list-with-join fetches
   * previously used just to render tab-count badges on /saved and /activity.
   *
   * @param {{ id: string }} user - Current user context
   * @returns {Promise<MeListCountsResponseDto>} Counts for each list
   */
  @Get('lists/counts')
  @ApiOperation({ summary: 'Counts of my lists (auth: Bearer)' })
  @ApiOkResponse({ type: MeListCountsResponseDto })
  async listCounts(@CurrentUser() user: { id: string }): Promise<MeListCountsResponseDto> {
    return this.meListsService.getListCounts(user.id);
  }

  /**
   * Gets updates for user's highly-rated shows.
   *
   * Returns shows rated >= 60 that have recent or upcoming episodes.
   *
   * @param {{ id: string }} user - Current user context
   * @returns {Promise<FavoriteUpdatesResponseDto>} Shows with episode updates
   */
  @Get('favorites/updates')
  @ApiOperation({ summary: 'Updates for my favorite shows (auth: Bearer)' })
  @ApiOkResponse({ type: FavoriteUpdatesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async favoriteUpdates(@CurrentUser() user: { id: string }): Promise<FavoriteUpdatesResponseDto> {
    const data = await this.meListsService.getFavoriteUpdates(user.id);
    return { data };
  }
}
