import { Inject, Injectable } from '@nestjs/common';

import {
  FAVORITE_UPDATES_DAYS_AHEAD,
  FAVORITE_UPDATES_DAYS_BACK,
  FAVORITE_UPDATES_LIMIT,
  FAVORITE_UPDATES_RATING_THRESHOLD,
} from '../domain/constants/favorite-updates.constants';
import {
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_STATE,
  USER_MEDIA_WATCHLIST_STATES,
} from '../domain/entities/user-media-state.entity';
import {
  type FavoriteUpdateItem,
  type IUserMediaStateRepository,
  USER_MEDIA_LIST_SORT,
  USER_MEDIA_STATE_REPOSITORY,
  type UserMediaListSort,
} from '../domain/repositories/user-media-state.repository.interface';

import { UserMediaService } from './user-media.service';

/**
 * Provides owner-only user media list queries with total counts.
 */
@Injectable()
export class MeListsService {
  constructor(
    private readonly userMediaService: UserMediaService,
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
  ) {}

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

  /**
   * Gets paused items for the current user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @param {UserMediaListSort} sort - Sort order
   * @returns {Promise<{ total: number; data: any }>} Total count and page items
   */
  async getPaused(userId: string, limit: number, offset: number, sort?: UserMediaListSort) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: [USER_MEDIA_STATE.PAUSED], sort: effectiveSort };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.PAUSED] }),
      this.userMediaService.listWithMedia(userId, limit, offset, options),
    ]);

    return { total, data };
  }

  /**
   * Gets caught-up items (ongoing shows where all aired episodes are watched).
   */
  async getCaughtUp(userId: string, limit: number, offset: number, sort?: UserMediaListSort) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: [USER_MEDIA_STATE.CAUGHT_UP], sort: effectiveSort };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.CAUGHT_UP] }),
      this.userMediaService.listWithMedia(userId, limit, offset, options),
    ]);

    return { total, data };
  }

  /**
   * Gets dropped items for the current user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @param {UserMediaListSort} sort - Sort order
   * @returns {Promise<{ total: number; data: any }>} Total count and page items
   */
  async getDropped(userId: string, limit: number, offset: number, sort?: UserMediaListSort) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: [USER_MEDIA_STATE.DROPPED], sort: effectiveSort };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.DROPPED] }),
      this.userMediaService.listWithMedia(userId, limit, offset, options),
    ]);

    return { total, data };
  }

  /**
   * Gets updates for user's highly-rated shows.
   *
   * Accesses the repository directly instead of delegating through UserMediaService
   * because this query is a specialized, read-only aggregation that does not share
   * filtering/sorting logic with the standard list methods exposed by UserMediaService.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<FavoriteUpdateItem[]>} Shows with recent/upcoming episodes
   */
  async getFavoriteUpdates(userId: string): Promise<FavoriteUpdateItem[]> {
    return this.repo.listFavoriteUpdates(userId, {
      ratingThreshold: FAVORITE_UPDATES_RATING_THRESHOLD,
      daysBack: FAVORITE_UPDATES_DAYS_BACK,
      daysAhead: FAVORITE_UPDATES_DAYS_AHEAD,
      limit: FAVORITE_UPDATES_LIMIT,
    });
  }
}
