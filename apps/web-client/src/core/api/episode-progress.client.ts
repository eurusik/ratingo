/**
 * Typed episode progress API client.
 *
 * Provides type-safe methods for episode watch tracking endpoints.
 */

import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost, apiDelete } from './client';

// ============================================================================
// Types from api-contract
// ============================================================================

export type SeasonProgressDto = components['schemas']['SeasonProgressDto'];
export type ShowProgressDto = components['schemas']['ShowProgressDto'];
type BatchEpisodeIdsDto = components['schemas']['BatchEpisodeIdsDto'];

// ============================================================================
// Helpers
// ============================================================================

/** Must match MAX_BATCH_EPISODE_IDS from apps/api/.../episode-progress.constants.ts */
const BATCH_LIMIT = 200;

/** Splits an array into chunks of at most `size` elements. */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ============================================================================
// API Client
// ============================================================================

export const episodeProgressApi = {
  /**
   * Marks an episode as watched.
   *
   * @param episodeId - Episode UUID
   * @returns void (204 No Content)
   */
  async markWatched(episodeId: string): Promise<void> {
    return apiPost<void>(`user-media/episodes/${episodeId}/watch`);
  },

  /**
   * Marks an episode as unwatched.
   *
   * @param episodeId - Episode UUID
   * @returns void (204 No Content)
   */
  async markUnwatched(episodeId: string): Promise<void> {
    return apiDelete<void>(`user-media/episodes/${episodeId}/watch`);
  },

  /**
   * Marks multiple episodes as watched in a single batch request.
   *
   * @param episodeIds - Array of episode UUIDs
   * @returns void (204 No Content)
   */
  async markBatchWatched(episodeIds: string[]): Promise<void> {
    if (episodeIds.length === 0) return;
    const chunks = chunk(episodeIds, BATCH_LIMIT);
    for (const batch of chunks) {
      await apiPost<void>('user-media/episodes/batch/watch', { episodeIds: batch } satisfies BatchEpisodeIdsDto);
    }
  },

  /**
   * Marks multiple episodes as unwatched in a single batch request.
   *
   * @param episodeIds - Array of episode UUIDs
   * @returns void (204 No Content)
   */
  async markBatchUnwatched(episodeIds: string[]): Promise<void> {
    if (episodeIds.length === 0) return;
    const chunks = chunk(episodeIds, BATCH_LIMIT);
    for (const batch of chunks) {
      await apiPost<void>('user-media/episodes/batch/unwatch', { episodeIds: batch } satisfies BatchEpisodeIdsDto);
    }
  },

  /**
   * Gets watch progress for all seasons of a show.
   *
   * @param showId - Show UUID (from shows table)
   * @returns Progress per season
   */
  async getShowProgress(showId: string): Promise<ShowProgressDto> {
    return apiGet<ShowProgressDto>(`user-media/shows/${showId}/progress`);
  },
} as const;
