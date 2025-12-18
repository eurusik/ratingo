/**
 * Typed user actions API client.
 *
 * Provides type-safe methods for saved items and subscriptions endpoints.
 *
 * @example
 * import { userActionsApi } from '@/core/api/user-actions';
 * const result = await userActionsApi.saveItem({ mediaItemId: '...', list: 'for_later' });
 */

import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost, apiDelete } from './client';

// ============================================================================
// Types from api-contract
// ============================================================================

export type SavedItemList = components['schemas']['SaveItemDto']['list'];
export type SubscriptionTrigger = components['schemas']['SubscribeDto']['trigger'];

export type MediaSaveStatusDto = components['schemas']['MediaSaveStatusDto'];
export type SaveActionResultDto = components['schemas']['SaveActionResultDto'];
export type UnsaveActionResultDto = components['schemas']['UnsaveActionResultDto'];
export type MediaSubscriptionStatusDto = components['schemas']['MediaSubscriptionStatusDto'];
export type SubscribeActionResultDto = components['schemas']['SubscribeActionResultDto'];
export type UnsubscribeActionResultDto = components['schemas']['UnsubscribeActionResultDto'];

export interface SaveItemParams {
  mediaItemId: string;
  list: SavedItemList;
  context?: string;
  reasonKey?: string;
}

export interface UnsaveItemParams {
  mediaItemId: string;
  list: SavedItemList;
  context?: string;
}

export interface SubscribeParams {
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  context?: string;
  reasonKey?: string;
}

export interface UnsubscribeParams {
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  context?: string;
}

// ============================================================================
// API Client
// ============================================================================

export const userActionsApi = {
  // --------------------------------------------------------------------------
  // Saved Items
  // --------------------------------------------------------------------------

  /**
   * Save a media item to a list.
   *
   * @param params - Save parameters
   * @returns Save action result with current status
   */
  async saveItem(params: SaveItemParams): Promise<SaveActionResultDto> {
    const { mediaItemId, ...body } = params;
    return apiPost<SaveActionResultDto>(`me/saved-items/${mediaItemId}`, body);
  },

  /**
   * Remove a media item from a list.
   *
   * @param params - Unsave parameters
   * @returns Unsave action result with current status
   */
  async unsaveItem(params: UnsaveItemParams): Promise<UnsaveActionResultDto> {
    const { mediaItemId, ...body } = params;
    return apiDelete<UnsaveActionResultDto>(`me/saved-items/${mediaItemId}`, { json: body });
  },

  /**
   * Get save status for a media item.
   *
   * @param mediaItemId - Media item ID
   * @returns Current save status
   */
  async getSaveStatus(mediaItemId: string): Promise<MediaSaveStatusDto> {
    return apiGet<MediaSaveStatusDto>(`me/saved-items/${mediaItemId}/status`);
  },

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to notifications for a media item.
   *
   * @param params - Subscribe parameters
   * @returns Subscribe action result with current status
   */
  async subscribe(params: SubscribeParams): Promise<SubscribeActionResultDto> {
    const { mediaItemId, ...body } = params;
    return apiPost<SubscribeActionResultDto>(`me/subscriptions/${mediaItemId}`, body);
  },

  /**
   * Unsubscribe from notifications for a media item.
   *
   * @param params - Unsubscribe parameters
   * @returns Unsubscribe action result with current status
   */
  async unsubscribe(params: UnsubscribeParams): Promise<UnsubscribeActionResultDto> {
    const { mediaItemId, ...body } = params;
    return apiDelete<UnsubscribeActionResultDto>(`me/subscriptions/${mediaItemId}`, { json: body });
  },

  /**
   * Get subscription status for a media item.
   *
   * @param mediaItemId - Media item ID
   * @returns Current subscription status
   */
  async getSubscriptionStatus(mediaItemId: string): Promise<MediaSubscriptionStatusDto> {
    return apiGet<MediaSubscriptionStatusDto>(`me/subscriptions/${mediaItemId}/status`);
  },
} as const;
