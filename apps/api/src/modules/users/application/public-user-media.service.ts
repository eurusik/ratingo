import { Injectable } from '@nestjs/common';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import {
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_LIST_SORT,
  USER_MEDIA_WATCHLIST_STATES,
  type UserMediaState,
  UserMediaService,
} from '../../user-media/public';
import { type User } from '../domain/entities/user.entity';
import {
  type PublicUserMediaListQuery,
  type PublicUserMediaPage,
} from '../domain/read-models/public-user-media-list';

import { UserProfileVisibilityPolicy, type ViewerContext } from './user-profile-visibility.policy';
import { UsersService } from './users.service';

type PublicUserMediaFilter = { ratedOnly: true } | { states: Array<UserMediaState['state']> };

/**
 * Application service for reading public user media lists with privacy enforcement.
 */
@Injectable()
export class PublicUserMediaService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userMediaService: UserMediaService,
  ) {}

  /**
   * Lists rated items when viewer is allowed to see ratings.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context
   * @param {PublicUserMediaListQuery} query - Pagination and sorting query
   * @returns {Promise<PublicUserMediaPage | null>} Total count and list items, or null when user not found / not visible
   */
  async getRatings(
    username: string,
    viewer?: ViewerContext,
    query?: PublicUserMediaListQuery,
  ): Promise<PublicUserMediaPage | null> {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewRatings(user, viewer)) return null;

    return this.listPage(user, viewer, query, { ratedOnly: true });
  }

  /**
   * Lists planned items (watchlist) when viewer is allowed to see watch history.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context
   * @param {PublicUserMediaListQuery} query - Pagination and sorting query
   * @returns {Promise<PublicUserMediaPage | null>} Total count and list items, or null when user not found / not visible
   */
  async getWatchlist(
    username: string,
    viewer?: ViewerContext,
    query?: PublicUserMediaListQuery,
  ): Promise<PublicUserMediaPage | null> {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewWatchHistory(user, viewer)) return null;

    return this.listPage(user, viewer, query, { states: USER_MEDIA_WATCHLIST_STATES });
  }

  /**
   * Lists in-progress or completed items (watch history) when viewer is allowed.
   *
   * @param {string} username - Username
   * @param {ViewerContext} viewer - Optional viewer context
   * @param {PublicUserMediaListQuery} query - Pagination and sorting query
   * @returns {Promise<PublicUserMediaPage | null>} Total count and list items, or null when user not found / not visible
   */
  async getHistory(
    username: string,
    viewer?: ViewerContext,
    query?: PublicUserMediaListQuery,
  ): Promise<PublicUserMediaPage | null> {
    const user = await this.usersService.getByUsername(username);
    if (!user) return null;

    if (!UserProfileVisibilityPolicy.canViewWatchHistory(user, viewer)) return null;

    return this.listPage(user, viewer, query, { states: USER_MEDIA_HISTORY_STATES });
  }

  private async listPage(
    user: User,
    viewer: ViewerContext | undefined,
    query: PublicUserMediaListQuery | undefined,
    filter: PublicUserMediaFilter,
  ): Promise<PublicUserMediaPage> {
    const limit = query?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query?.offset ?? 0;
    const sort = query?.sort ?? USER_MEDIA_LIST_SORT.RECENT;

    const [total, items] = await Promise.all([
      this.userMediaService.countWithMedia(user.id, filter),
      this.userMediaService.listWithMedia(user.id, limit, offset, { ...filter, sort }),
    ]);

    const isOwnerOrAdmin = UserProfileVisibilityPolicy.isOwnerOrAdmin(user, viewer);
    const data = items.map((item) => ({
      id: item.id,
      state: item.state,
      rating: item.rating,
      progress: isOwnerOrAdmin ? item.progress : null,
      notes: isOwnerOrAdmin ? item.notes : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      mediaSummary: item.mediaSummary,
    }));

    return { total, data };
  }
}
