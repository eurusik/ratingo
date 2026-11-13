import type { GetData, components } from '@ratingo/api-contract';
import { apiDelete, apiGet, apiPost } from '@ratingo/web-core/api';

export type MediaSaveStatus = components['schemas']['MediaSaveStatusDto'];
export type SaveList = components['schemas']['SaveItemDto']['list'];
type SaveResult = components['schemas']['SaveActionResultDto'];
type UnsaveResult = components['schemas']['UnsaveActionResultDto'];
type BatchRatings = GetData<'/api/user-media/batch-ratings'>;

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
} as const;
