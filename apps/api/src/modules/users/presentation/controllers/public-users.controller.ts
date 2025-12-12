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
} from '../dto/public-user-media.dto';

@ApiTags('Public: Users')
@UseGuards(OptionalJwtAuthGuard)
@Controller('users')
export class PublicUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly publicUserMediaService: PublicUserMediaService,
  ) {}

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

  @ApiOperation({ summary: 'Get public user ratings (auth optional, privacy aware)' })
  @ApiOkResponse({ type: PublicUserMediaListItemDto, isArray: true })
  @Get(':username/ratings')
  async getRatings(
    @Param('username') username: string,
    @CurrentUser() viewer?: ViewerContext,
    @Query() query?: PublicUserMediaListQueryDto,
  ): Promise<PublicUserMediaListItemDto[]> {
    const result = await this.publicUserMediaService.getRatings(username, viewer, query);
    if (!result) throw new NotFoundException('User not found');
    return result as PublicUserMediaListItemDto[];
  }

  @ApiOperation({ summary: 'Get public user watchlist (auth optional, privacy aware)' })
  @ApiOkResponse({ type: PublicUserMediaListItemDto, isArray: true })
  @Get(':username/watchlist')
  async getWatchlist(
    @Param('username') username: string,
    @CurrentUser() viewer?: ViewerContext,
    @Query() query?: PublicUserMediaListQueryDto,
  ): Promise<PublicUserMediaListItemDto[]> {
    const result = await this.publicUserMediaService.getWatchlist(username, viewer, query);
    if (!result) throw new NotFoundException('User not found');
    return result as PublicUserMediaListItemDto[];
  }

  @ApiOperation({ summary: 'Get public user watch history (auth optional, privacy aware)' })
  @ApiOkResponse({ type: PublicUserMediaListItemDto, isArray: true })
  @Get(':username/history')
  async getHistory(
    @Param('username') username: string,
    @CurrentUser() viewer?: ViewerContext,
    @Query() query?: PublicUserMediaListQueryDto,
  ): Promise<PublicUserMediaListItemDto[]> {
    const result = await this.publicUserMediaService.getHistory(username, viewer, query);
    if (!result) throw new NotFoundException('User not found');
    return result as PublicUserMediaListItemDto[];
  }
}
