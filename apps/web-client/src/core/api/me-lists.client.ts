/**
 * Typed me-lists API client.
 *
 * Provides type-safe methods for watchlist and history endpoints.
 */

import type { components } from '@ratingo/api-contract';
import type { MediaType } from '@/shared/types';
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

export interface MeListsParams {
  limit?: number;
  offset?: number;
  sort?: 'recent' | 'rating' | 'releaseDate';
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
   * Get user's state for a specific media item.
   *
   * @param mediaItemId - Media item ID
   * @returns User media state or null if not found
   */
  async getState(mediaItemId: string): Promise<MeUserMediaListItemDto | null> {
    try {
      return await apiGet<MeUserMediaListItemDto>(`user-media/${mediaItemId}`);
    } catch {
      return null;
    }
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
