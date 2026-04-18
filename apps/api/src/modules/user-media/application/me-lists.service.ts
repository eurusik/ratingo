import { Inject, Injectable } from '@nestjs/common';

import { type MediaType } from '../../../common/enums/media-type.enum';
import { SAVED_ITEM_LIST, SavedItemsService } from '../../user-actions/public';
import {
  FAVORITE_UPDATES_DAYS_AHEAD,
  FAVORITE_UPDATES_DAYS_BACK,
  FAVORITE_UPDATES_LIMIT,
  FAVORITE_UPDATES_RATING_THRESHOLD,
} from '../domain/constants/favorite-updates.constants';
import { type UserListCounts } from '../domain/entities/user-list-counts.entity';
import {
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_STATE,
  USER_MEDIA_WATCHLIST_STATES,
  type UserMediaHistoryState,
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
    private readonly savedItemsService: SavedItemsService,
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
  async getRatings(
    userId: string,
    limit: number,
    offset: number,
    sort?: UserMediaListSort,
    type?: MediaType,
  ) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { ratedOnly: true, type }),
      this.userMediaService.listWithMedia(userId, limit, offset, {
        ratedOnly: true,
        sort: effectiveSort,
        type,
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
  async getWatchlist(
    userId: string,
    limit: number,
    offset: number,
    sort?: UserMediaListSort,
    type?: MediaType,
  ) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: USER_MEDIA_WATCHLIST_STATES, sort: effectiveSort, type };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: USER_MEDIA_WATCHLIST_STATES, type }),
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
   * @param {UserMediaHistoryState} state - Narrow history to a single state
   *   (watching, completed, or paused). DTO validation guarantees the value
   *   belongs to HISTORY_STATES before it reaches this service.
   * @returns {Promise<{ total: number; data: any }>} Total count and page items
   */
  async getHistory(
    userId: string,
    limit: number,
    offset: number,
    sort?: UserMediaListSort,
    type?: MediaType,
    state?: UserMediaHistoryState,
  ) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const states = state ? [state] : USER_MEDIA_HISTORY_STATES;
    const options = { states, sort: effectiveSort, type };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states, type }),
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
  async getActivity(userId: string, limit: number, offset: number, type?: MediaType) {
    const [total, data] = await Promise.all([
      this.userMediaService.countActivityWithMedia(userId, type),
      this.userMediaService.listActivityWithMedia(userId, limit, offset, type),
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
  async getPaused(
    userId: string,
    limit: number,
    offset: number,
    sort?: UserMediaListSort,
    type?: MediaType,
  ) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: [USER_MEDIA_STATE.PAUSED], sort: effectiveSort, type };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.PAUSED], type }),
      this.userMediaService.listWithMedia(userId, limit, offset, options),
    ]);

    return { total, data };
  }

  /**
   * Gets caught-up items (ongoing shows where all aired episodes are watched).
   */
  async getCaughtUp(
    userId: string,
    limit: number,
    offset: number,
    sort?: UserMediaListSort,
    type?: MediaType,
  ) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: [USER_MEDIA_STATE.CAUGHT_UP], sort: effectiveSort, type };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.CAUGHT_UP], type }),
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
  async getDropped(
    userId: string,
    limit: number,
    offset: number,
    sort?: UserMediaListSort,
    type?: MediaType,
  ) {
    const effectiveSort = sort ?? USER_MEDIA_LIST_SORT.RECENT;
    const options = { states: [USER_MEDIA_STATE.DROPPED], sort: effectiveSort, type };

    const [total, data] = await Promise.all([
      this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.DROPPED], type }),
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

  /**
   * Gets aggregated counts for all user lists in parallel.
   * Used to render tab badges cheaply, without fetching full list payloads.
   *
   * Uses strict state matching (not the "activity" OR-progress semantics),
   * so buckets are mutually exclusive: a paused-with-progress item is counted
   * ONLY in `paused`, never in `watching`. This keeps badge arithmetic
   * intuitive and prevents overlap with the Paused/Dropped tabs.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<UserListCounts>} Counts for each list
   */
  async getListCounts(userId: string): Promise<UserListCounts> {
    const [watching, paused, dropped, completed, caughtUp, forLater, considering] =
      await Promise.all([
        this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.WATCHING] }),
        this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.PAUSED] }),
        this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.DROPPED] }),
        this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.COMPLETED] }),
        this.userMediaService.countWithMedia(userId, { states: [USER_MEDIA_STATE.CAUGHT_UP] }),
        this.savedItemsService.countByList(userId, SAVED_ITEM_LIST.FOR_LATER),
        this.savedItemsService.countByList(userId, SAVED_ITEM_LIST.CONSIDERING),
      ]);

    return { watching, paused, dropped, completed, caughtUp, forLater, considering };
  }
}
