import { Injectable } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserProfileVisibilityPolicy, ViewerContext } from './user-profile-visibility.policy';
import { UserMediaService } from '../../user-media/application/user-media.service';
import {
  PublicUserMediaListQueryDto,
  USER_MEDIA_LIST_SORT,
} from '../presentation/dto/public-user-media.dto';
import { UserMediaState } from '../../user-media/domain/entities/user-media-state.entity';

@Injectable()
export class PublicUserMediaService {
  private static readonly WATCHLIST_STATES: UserMediaState['state'][] = ['planned'];
  private static readonly HISTORY_STATES: UserMediaState['state'][] = ['watching', 'completed'];

  /**
   * Reads public user media slices (ratings/watchlist/history) with privacy enforcement.
   * Caller must pass viewer for owner/admin overrides; returns null when section is not visible.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly userMediaService: UserMediaService,
  ) {}

  /**
   * Lists rated items if the viewer is allowed to see ratings.
   */
  async getRatings(username: string, viewer?: ViewerContext, query?: PublicUserMediaListQueryDto) {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewRatings(user, viewer)) return null;

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const sort = query?.sort ?? USER_MEDIA_LIST_SORT.RECENT;

    const items = await this.userMediaService.listWithMedia(user.id, limit, offset, {
      ratedOnly: true,
      sort,
    });

    const isOwnerOrAdmin = UserProfileVisibilityPolicy.isOwnerOrAdmin(user, viewer);
    return items.map((i) => ({
      id: i.id,
      state: i.state,
      rating: i.rating,
      progress: isOwnerOrAdmin ? i.progress : null,
      notes: isOwnerOrAdmin ? i.notes : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      mediaSummary: i.mediaSummary,
    }));
  }

  /**
   * Lists planned items (watchlist) if the viewer is allowed to see watch history.
   */
  async getWatchlist(
    username: string,
    viewer?: ViewerContext,
    query?: PublicUserMediaListQueryDto,
  ) {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewWatchHistory(user, viewer)) return null;

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const sort = query?.sort ?? USER_MEDIA_LIST_SORT.RECENT;

    const items = await this.userMediaService.listWithMedia(user.id, limit, offset, {
      states: PublicUserMediaService.WATCHLIST_STATES,
      sort,
    });

    const isOwnerOrAdmin = UserProfileVisibilityPolicy.isOwnerOrAdmin(user, viewer);
    return items.map((i) => ({
      id: i.id,
      state: i.state,
      rating: i.rating,
      progress: isOwnerOrAdmin ? i.progress : null,
      notes: isOwnerOrAdmin ? i.notes : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      mediaSummary: i.mediaSummary,
    }));
  }

  /**
   * Lists in-progress or completed items (watch history) if the viewer is allowed.
   */
  async getHistory(username: string, viewer?: ViewerContext, query?: PublicUserMediaListQueryDto) {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewWatchHistory(user, viewer)) return null;

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const sort = query?.sort ?? USER_MEDIA_LIST_SORT.RECENT;

    const items = await this.userMediaService.listWithMedia(user.id, limit, offset, {
      states: PublicUserMediaService.HISTORY_STATES,
      sort,
    });

    const isOwnerOrAdmin = UserProfileVisibilityPolicy.isOwnerOrAdmin(user, viewer);
    return items.map((i) => ({
      id: i.id,
      state: i.state,
      rating: i.rating,
      progress: isOwnerOrAdmin ? i.progress : null,
      notes: isOwnerOrAdmin ? i.notes : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      mediaSummary: i.mediaSummary,
    }));
  }
}
