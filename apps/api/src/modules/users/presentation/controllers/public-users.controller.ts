import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../../application/users.service';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { PublicUserProfileDto } from '../dto/public-user-profile.dto';
import { ViewerContext } from '../../application/user-profile-visibility.policy';
import { PublicUserMediaService } from '../../application/public-user-media.service';
import {
  PublicUserMediaListItemDto,
  PublicUserMediaListQueryDto,
  PaginatedPublicUserMediaResponseDto,
} from '../dto/public-user-media.dto';

/**
 * Exposes public user profile and list endpoints.
 */
@ApiTags('Public: Users')
@UseGuards(OptionalJwtAuthGuard)
@Controller('users')
export class PublicUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly publicUserMediaService: PublicUserMediaService,
  ) {}

  /**
   * Gets public user profile by username.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context (auth optional)
   * @returns {Promise<PublicUserProfileDto>} Public user profile
   * @throws {NotFoundException} When user is not found or profile is not visible
   */
  @ApiOperation({ summary: 'Get public user profile by username (auth optional, privacy aware)' })
  @Get(':username')
  async getPublicProfile(
    @Param('username') username: string,
    @CurrentUser() viewer?: ViewerContext,
  ): Promise<PublicUserProfileDto> {
    const profile = await this.usersService.getPublicProfileByUsername(username, viewer);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile as PublicUserProfileDto;
  }

  /**
   * Gets public user ratings list.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context (auth optional)
   * @param {PublicUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedPublicUserMediaResponseDto>} Paginated public ratings
   * @throws {NotFoundException} When user is not found
   */
  @ApiOperation({ summary: 'Get public user ratings (auth optional, privacy aware)' })
  @ApiOkResponse({ type: PaginatedPublicUserMediaResponseDto })
  @Get(':username/ratings')
  async getRatings(
    @Param('username') username: string,
    @CurrentUser() viewer?: ViewerContext,
    @Query() query?: PublicUserMediaListQueryDto,
  ): Promise<PaginatedPublicUserMediaResponseDto> {
    const result = await this.publicUserMediaService.getRatings(username, viewer, query);
    if (!result) throw new NotFoundException('User not found');

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const items = result.data as PublicUserMediaListItemDto[];

    return {
      data: items,
      meta: {
        count: items.length,
        total: result.total,
        limit,
        offset,
        hasMore: offset + items.length < result.total,
      },
    };
  }

  /**
   * Gets public user watchlist.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context (auth optional)
   * @param {PublicUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedPublicUserMediaResponseDto>} Paginated public watchlist
   * @throws {NotFoundException} When user is not found
   */
  @ApiOperation({ summary: 'Get public user watchlist (auth optional, privacy aware)' })
  @ApiOkResponse({ type: PaginatedPublicUserMediaResponseDto })
  @Get(':username/watchlist')
  async getWatchlist(
    @Param('username') username: string,
    @CurrentUser() viewer?: ViewerContext,
    @Query() query?: PublicUserMediaListQueryDto,
  ): Promise<PaginatedPublicUserMediaResponseDto> {
    const result = await this.publicUserMediaService.getWatchlist(username, viewer, query);
    if (!result) throw new NotFoundException('User not found');

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const items = result.data as PublicUserMediaListItemDto[];

    return {
      data: items,
      meta: {
        count: items.length,
        total: result.total,
        limit,
        offset,
        hasMore: offset + items.length < result.total,
      },
    };
  }

  /**
   * Gets public user watch history.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context (auth optional)
   * @param {PublicUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<PaginatedPublicUserMediaResponseDto>} Paginated public watch history
   * @throws {NotFoundException} When user is not found
   */
  @ApiOperation({ summary: 'Get public user watch history (auth optional, privacy aware)' })
  @ApiOkResponse({ type: PaginatedPublicUserMediaResponseDto })
  @Get(':username/history')
  async getHistory(
    @Param('username') username: string,
    @CurrentUser() viewer?: ViewerContext,
    @Query() query?: PublicUserMediaListQueryDto,
  ): Promise<PaginatedPublicUserMediaResponseDto> {
    const result = await this.publicUserMediaService.getHistory(username, viewer, query);
    if (!result) throw new NotFoundException('User not found');

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const items = result.data as PublicUserMediaListItemDto[];

    return {
      data: items,
      meta: {
        count: items.length,
        total: result.total,
        limit,
        offset,
        hasMore: offset + items.length < result.total,
      },
    };
  }
}
