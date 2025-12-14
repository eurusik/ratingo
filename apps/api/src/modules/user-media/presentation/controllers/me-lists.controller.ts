import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { MeListsService } from '../../application/me-lists.service';
import {
  MeUserMediaListQueryDto,
  MeUserMediaListItemDto,
  PaginatedMeUserMediaResponseDto,
} from '../dto/me-lists.dto';
import { UserMediaState } from '../../domain/entities/user-media-state.entity';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

type UserMediaWithSummary = UserMediaState & {
  mediaSummary: {
    id: string;
    type: MediaType;
    title: string;
    slug: string;
    poster: ImageDto | null;
    releaseDate?: Date | null;
  };
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
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getRatings(
      user.id,
      limit,
      offset,
      query.sort,
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
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getWatchlist(
      user.id,
      limit,
      offset,
      query.sort,
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
    @Query() query: MeUserMediaListQueryDto,
  ): Promise<PaginatedMeUserMediaResponseDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getHistory(
      user.id,
      limit,
      offset,
      query.sort,
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
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const { total, data } = await this.meListsService.getActivity(user.id, limit, offset);

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
}
