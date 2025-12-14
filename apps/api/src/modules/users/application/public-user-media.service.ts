import { Injectable } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserProfileVisibilityPolicy, ViewerContext } from './user-profile-visibility.policy';
import { UserMediaService } from '../../user-media/application/user-media.service';
import {
  PublicUserMediaListQueryDto,
  USER_MEDIA_LIST_SORT,
} from '../presentation/dto/public-user-media.dto';
import {
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_WATCHLIST_STATES,
} from '../../user-media/domain/entities/user-media-state.entity';

/**
 * Application service for reading public user media lists with privacy enforcement.
 */
@Injectable()
export class PublicUserMediaService {
  /**
   * Reads public user media slices (ratings/watchlist/history) with privacy enforcement.
   * Returns null when section is not visible.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly userMediaService: UserMediaService,
  ) {}

  /**
   * Lists rated items when viewer is allowed to see ratings.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context
   * @param {PublicUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<{ total: number; data: any } | null>} Total count and list items, or null when user not found / not visible
   */
  async getRatings(username: string, viewer?: ViewerContext, query?: PublicUserMediaListQueryDto) {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewRatings(user, viewer)) return null;

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const sort = query?.sort ?? USER_MEDIA_LIST_SORT.RECENT;

    const [total, items] = await Promise.all([
      this.userMediaService.countWithMedia(user.id, { ratedOnly: true }),
      this.userMediaService.listWithMedia(user.id, limit, offset, { ratedOnly: true, sort }),
    ]);

    const isOwnerOrAdmin = UserProfileVisibilityPolicy.isOwnerOrAdmin(user, viewer);
    const data = items.map((i) => ({
      id: i.id,
      state: i.state,
      rating: i.rating,
      progress: isOwnerOrAdmin ? i.progress : null,
      notes: isOwnerOrAdmin ? i.notes : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      mediaSummary: i.mediaSummary,
    }));

    return { total, data };
  }

  /**
   * Lists planned items (watchlist) when viewer is allowed to see watch history.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context
   * @param {PublicUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<{ total: number; data: any } | null>} Total count and list items, or null when user not found / not visible
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

    const [total, items] = await Promise.all([
      this.userMediaService.countWithMedia(user.id, { states: USER_MEDIA_WATCHLIST_STATES }),
      this.userMediaService.listWithMedia(user.id, limit, offset, {
        states: USER_MEDIA_WATCHLIST_STATES,
        sort,
      }),
    ]);

    const isOwnerOrAdmin = UserProfileVisibilityPolicy.isOwnerOrAdmin(user, viewer);
    const data = items.map((i) => ({
      id: i.id,
      state: i.state,
      rating: i.rating,
      progress: isOwnerOrAdmin ? i.progress : null,
      notes: isOwnerOrAdmin ? i.notes : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      mediaSummary: i.mediaSummary,
    }));

    return { total, data };
  }

  /**
   * Lists in-progress or completed items (watch history) when viewer is allowed.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context
   * @param {PublicUserMediaListQueryDto} query - Pagination and sorting query
   * @returns {Promise<{ total: number; data: any } | null>} Total count and list items, or null when user not found / not visible
   */
  async getHistory(username: string, viewer?: ViewerContext, query?: PublicUserMediaListQueryDto) {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewWatchHistory(user, viewer)) return null;

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const sort = query?.sort ?? USER_MEDIA_LIST_SORT.RECENT;

    const [total, items] = await Promise.all([
      this.userMediaService.countWithMedia(user.id, { states: USER_MEDIA_HISTORY_STATES }),
      this.userMediaService.listWithMedia(user.id, limit, offset, {
        states: USER_MEDIA_HISTORY_STATES,
        sort,
      }),
    ]);

    const isOwnerOrAdmin = UserProfileVisibilityPolicy.isOwnerOrAdmin(user, viewer);
    const data = items.map((i) => ({
      id: i.id,
      state: i.state,
      rating: i.rating,
      progress: isOwnerOrAdmin ? i.progress : null,
      notes: isOwnerOrAdmin ? i.notes : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      mediaSummary: i.mediaSummary,
    }));

    return { total, data };
  }
}
