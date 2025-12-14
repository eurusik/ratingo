import { Injectable } from '@nestjs/common';
import { UserMediaService } from './user-media.service';
import {
  USER_MEDIA_LIST_SORT,
  UserMediaListSort,
} from '../domain/repositories/user-media-state.repository.interface';
import {
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_WATCHLIST_STATES,
} from '../domain/entities/user-media-state.entity';

/**
 * Provides owner-only user media list queries with total counts.
 */
@Injectable()
export class MeListsService {
  constructor(private readonly userMediaService: UserMediaService) {}

  /**
   * Gets rated items for the current user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @param {UserMediaListSort} sort - Sort order
   * @returns {Promise<{ total: number; data: any }>} Total count and page items
   */
  async getRatings(userId: string, limit: number, offset: number, sort?: UserMediaListSort) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { ratedOnly: true }),
      this.userMediaService.listWithMedia(userId, limit, offset, {
        ratedOnly: true,
        sort: effectiveSort,
      }),
    ]);

    return { total, data };
  }

  /**
   * Gets watchlist items for the current user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @param {UserMediaListSort} sort - Sort order
   * @returns {Promise<{ total: number; data: any }>} Total count and page items
   */
  async getWatchlist(userId: string, limit: number, offset: number, sort?: UserMediaListSort) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: USER_MEDIA_WATCHLIST_STATES, sort: effectiveSort };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: USER_MEDIA_WATCHLIST_STATES }),
      this.userMediaService.listWithMedia(userId, limit, offset, options),
    ]);

    return { total, data };
  }

  /**
   * Gets watch history items for the current user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @param {UserMediaListSort} sort - Sort order
   * @returns {Promise<{ total: number; data: any }>} Total count and page items
   */
  async getHistory(userId: string, limit: number, offset: number, sort?: UserMediaListSort) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: USER_MEDIA_HISTORY_STATES, sort: effectiveSort };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: USER_MEDIA_HISTORY_STATES }),
      this.userMediaService.listWithMedia(userId, limit, offset, options),
    ]);

    return { total, data };
  }

  /**
   * Gets in-progress activity items for the current user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<{ total: number; data: any }>} Total count and page items
   */
  async getActivity(userId: string, limit: number, offset: number) {
    const [total, data] = await Promise.all([
      this.userMediaService.countActivityWithMedia(userId),
      this.userMediaService.listActivityWithMedia(userId, limit, offset),
    ]);

    return { total, data };
  }
}
