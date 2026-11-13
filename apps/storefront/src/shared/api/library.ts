import type { GetData, components } from '@ratingo/api-contract';
import { apiDelete, apiGet, apiPatch, apiPost, isNotFoundError } from '@ratingo/web-core/api';
import type { MediaType } from './catalog';

export type MediaSaveStatus = components['schemas']['MediaSaveStatusDto'];
export type SaveList = components['schemas']['SaveItemDto']['list'];
type SaveResult = components['schemas']['SaveActionResultDto'];
type UnsaveResult = components['schemas']['UnsaveActionResultDto'];
type BatchRatings = GetData<'/api/user-media/batch-ratings'>;
type SetUserMediaState = components['schemas']['SetUserMediaStateDto'];
export type UserMediaState = components['schemas']['MeUserMediaListItemDto'];
export type WatchState = UserMediaState['state'];

interface BatchSaveStatuses {
  statuses: Record<string, MediaSaveStatus>;
}

export const libraryApi = {
  async getSaveStatuses(mediaItemIds: readonly string[]): Promise<Record<string, MediaSaveStatus>> {
    const batch = await apiGet<BatchSaveStatuses>('me/saved-items/status/batch', {
      searchParams: { ids: mediaItemIds.join(',') },
    });
    return batch.statuses;
  },

  async save(mediaItemId: string, list: SaveList): Promise<MediaSaveStatus> {
    const result = await apiPost<SaveResult>(`me/saved-items/${mediaItemId}`, {
      list,
      context: 'card',
    });
    return result.status;
  },

  async unsave(mediaItemId: string, list: SaveList): Promise<MediaSaveStatus> {
    const result = await apiDelete<UnsaveResult>(`me/saved-items/${mediaItemId}`, {
      json: { list, context: 'card' },
    });
    return result.status;
  },

  async getRatings(mediaItemIds: readonly string[]): Promise<Record<string, number>> {
    const batch = await apiGet<BatchRatings>('user-media/batch-ratings', {
      searchParams: { ids: mediaItemIds.join(',') },
    });
    return batch.ratings;
  },

  async getMediaState(mediaItemId: string): Promise<UserMediaState | null> {
    try {
      return await apiGet<UserMediaState>(`user-media/${mediaItemId}`);
    } catch (error) {
      if (await isNotFoundError(error)) return null;
      throw error;
    }
  },

  setRating(mediaItemId: string, rating: number | null, mediaType: MediaType) {
    return apiPatch<UserMediaState>(`user-media/${mediaItemId}`, {
      rating,
      mediaType,
    } satisfies SetUserMediaState);
  },
} as const;
