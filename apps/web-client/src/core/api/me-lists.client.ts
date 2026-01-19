/**
 * Typed me-lists API client.
 *
 * Provides type-safe methods for watchlist and history endpoints.
 */

import type { components } from '@ratingo/api-contract';
import { apiGet } from './client';

// ============================================================================
// Types from api-contract
// ============================================================================

export type MeUserMediaListItemDto = components['schemas']['MeUserMediaListItemDto'];
export type PaginatedMeUserMediaResponseDto = components['schemas']['PaginatedMeUserMediaResponseDto'];

export type UserMediaState = MeUserMediaListItemDto['state'];

/**
 * User media state constants (typed from api-contract).
 */
export const USER_MEDIA_STATE = {
  WATCHING: 'watching',
  COMPLETED: 'completed',
  PLANNED: 'planned',
  DROPPED: 'dropped',
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
} as const;
