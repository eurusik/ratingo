/**
 * Typed me-lists API client.
 *
 * Provides type-safe methods for watchlist and history endpoints.
 */

import type { components } from '@ratingo/api-contract';
import type { MediaType } from '@/shared/types';
import { HTTPError } from 'ky';
import { apiGet, apiPatch, apiPost } from './client';

// ============================================================================
// Types from api-contract
// ============================================================================

export type MeUserMediaListItemDto = components['schemas']['MeUserMediaListItemDto'];
export type PaginatedMeUserMediaResponseDto = components['schemas']['PaginatedMeUserMediaResponseDto'];
type SetUserMediaStateDto = components['schemas']['SetUserMediaStateDto'];

export type UserMediaState = MeUserMediaListItemDto['state'];

/**
 * User media state constants (typed from api-contract).
 */
export const USER_MEDIA_STATE = {
  WATCHING: 'watching',
  COMPLETED: 'completed',
  PLANNED: 'planned',
  DROPPED: 'dropped',
  PAUSED: 'paused',
} as const satisfies Record<string, UserMediaState>;

export type EpisodeInfo = components['schemas']['EpisodeInfoDto'];
export type FavoriteUpdateItem = components['schemas']['FavoriteUpdateItemDto'];
export type FavoriteUpdatesResponse = components['schemas']['FavoriteUpdatesResponseDto'];
export type BatchRatingsResponse = components['schemas']['BatchRatingsResponseDto'];

/** Sort values match the API contract query parameter. */
export type MeListSort = 'recent' | 'rating' | 'releaseDate';

export interface MeListsParams {
  limit?: number;
  offset?: number;
  sort?: MeListSort;
}

// ============================================================================
// API Client
// ============================================================================

export const meListsApi = {
  /**
   * Get user's watchlist (planned items).
   *
   * @param params - Pagination and sorting parameters
   * @returns Paginated watchlist items
   */
  async getWatchlist(params?: MeListsParams): Promise<PaginatedMeUserMediaResponseDto> {
    return apiGet<PaginatedMeUserMediaResponseDto>('me/watchlist', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Get user's watch history (watching/completed items).
   *
   * @param params - Pagination and sorting parameters
   * @returns Paginated history items
   */
  async getHistory(params?: MeListsParams): Promise<PaginatedMeUserMediaResponseDto> {
    return apiGet<PaginatedMeUserMediaResponseDto>('me/history', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Get user's paused items.
   *
   * @param params - Pagination and sorting parameters
   * @returns Paginated paused items
   */
  async getPaused(params?: MeListsParams): Promise<PaginatedMeUserMediaResponseDto> {
    return apiGet<PaginatedMeUserMediaResponseDto>('me/paused', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Get user's dropped items.
   *
   * @param params - Pagination and sorting parameters
   * @returns Paginated dropped items
   */
  async getDropped(params?: MeListsParams): Promise<PaginatedMeUserMediaResponseDto> {
    return apiGet<PaginatedMeUserMediaResponseDto>('me/dropped', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Pause a media item.
   *
   * @param mediaItemId - Media item ID to pause
   * @returns Updated user media state
   */
  async pauseMedia(mediaItemId: string): Promise<MeUserMediaListItemDto> {
    return apiPost<MeUserMediaListItemDto>(`user-media/${mediaItemId}/pause`);
  },

  /**
   * Resume a paused media item.
   *
   * @param mediaItemId - Media item ID to resume
   * @returns Updated user media state
   */
  async resumeMedia(mediaItemId: string): Promise<MeUserMediaListItemDto> {
    return apiPost<MeUserMediaListItemDto>(`user-media/${mediaItemId}/resume`);
  },

  /**
   * Drop a media item.
   *
   * @param mediaItemId - Media item ID to drop
   * @returns Updated user media state
   */
  async dropMedia(mediaItemId: string): Promise<MeUserMediaListItemDto> {
    return apiPatch<MeUserMediaListItemDto>(`user-media/${mediaItemId}`, {
      state: 'dropped',
    } satisfies Partial<SetUserMediaStateDto>);
  },

  /**
   * Restore a dropped media item back to watching.
   *
   * @param mediaItemId - Media item ID to restore
   * @returns Updated user media state
   */
  async restoreMedia(mediaItemId: string): Promise<MeUserMediaListItemDto> {
    return apiPatch<MeUserMediaListItemDto>(`user-media/${mediaItemId}`, {
      state: 'watching',
    } satisfies Partial<SetUserMediaStateDto>);
  },

  /**
   * Get user's state for a specific media item.
   *
   * @param mediaItemId - Media item ID
   * @returns User media state or null if not found
   */
  async getState(mediaItemId: string): Promise<MeUserMediaListItemDto | null> {
    try {
      return await apiGet<MeUserMediaListItemDto>(`user-media/${mediaItemId}`);
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Batch fetch user ratings for multiple media items.
   *
   * @param mediaItemIds - Array of media item IDs
   * @returns Map of mediaItemId → rating (0-100), only includes rated items
   */
  async getBatchRatings(mediaItemIds: string[]): Promise<Record<string, number>> {
    if (mediaItemIds.length === 0) return {};

    const ids = mediaItemIds.join(',');
    const result = await apiGet<BatchRatingsResponse>('user-media/batch-ratings', {
      searchParams: { ids } as Record<string, string>,
    });
    return result.ratings;
  },

  /**
   * Get updates for user's highly-rated shows.
   *
   * @returns Shows rated >= 60 with recent or upcoming episodes
   */
  async getFavoriteUpdates(): Promise<FavoriteUpdatesResponse> {
    return apiGet<FavoriteUpdatesResponse>('me/favorites/updates');
  },

  async setRating(
    mediaItemId: string,
    rating: number | null,
    mediaType: MediaType,
  ): Promise<MeUserMediaListItemDto> {
    return apiPatch<MeUserMediaListItemDto>(
      `user-media/${mediaItemId}`,
      { rating, mediaType } satisfies Partial<SetUserMediaStateDto>,
    );
  },
} as const;
