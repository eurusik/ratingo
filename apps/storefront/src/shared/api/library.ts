import type { GetData, components, operations } from '@ratingo/api-contract';
import {
  apiDelete,
  apiGet,
  apiGetOrNull,
  apiPatch,
  apiPatchOrNull,
  apiPost,
} from '@ratingo/web-core/api';
import type { MediaType } from './catalog';

export type MediaSaveStatus = components['schemas']['MediaSaveStatusDto'];
export type SaveList = components['schemas']['SaveItemDto']['list'];
type SaveResult = components['schemas']['SaveActionResultDto'];
type UnsaveResult = components['schemas']['UnsaveActionResultDto'];
type BatchRatings = GetData<'/api/user-media/batch-ratings'>;
type SetUserMediaState = components['schemas']['SetUserMediaStateDto'];
export type UserMediaState = components['schemas']['MeUserMediaListItemDto'];
export type WatchState = UserMediaState['state'];
export type LibraryPage = components['schemas']['PaginatedMeUserMediaResponseDto'];
export type LibraryCounts = components['schemas']['MeListCountsResponseDto'];
export type SavedItem = components['schemas']['SavedItemWithMediaResponseDto'];
export type SavedPage = components['schemas']['PaginatedSavedItemsResponseDto'];
type LibrarySort = NonNullable<
  NonNullable<operations['MeListsController_history']['parameters']['query']>['sort']
>;

export interface LibraryPageQuery {
  limit: number;
  offset: number;
  type?: MediaType;
  sort?: LibrarySort;
}

type HistoryState = NonNullable<
  NonNullable<operations['MeListsController_history']['parameters']['query']>['state']
>;

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

  getMediaState(mediaItemId: string): Promise<UserMediaState | null> {
    return apiGetOrNull<UserMediaState>(`user-media/${mediaItemId}`);
  },

  startWatching(mediaItemId: string): Promise<UserMediaState> {
    return apiPatch<UserMediaState>(`user-media/${mediaItemId}`, {
      state: 'watching',
    } satisfies SetUserMediaState);
  },

  getCounts(): Promise<LibraryCounts> {
    return apiGet<LibraryCounts>('me/lists/counts');
  },

  getHistory(query: LibraryPageQuery & { state?: HistoryState }): Promise<LibraryPage> {
    return apiGet<LibraryPage>('me/history', { searchParams: { ...query } });
  },

  getCaughtUp(query: LibraryPageQuery): Promise<LibraryPage> {
    return apiGet<LibraryPage>('me/caught-up', { searchParams: { ...query } });
  },

  getPaused(query: LibraryPageQuery): Promise<LibraryPage> {
    return apiGet<LibraryPage>('me/paused', { searchParams: { ...query } });
  },

  getDropped(query: LibraryPageQuery): Promise<LibraryPage> {
    return apiGet<LibraryPage>('me/dropped', { searchParams: { ...query } });
  },

  getSaved(list: SaveList, query: LibraryPageQuery): Promise<SavedPage> {
    const path = list === 'for_later' ? 'me/saved-items/for-later' : 'me/saved-items/considering';
    return apiGet<SavedPage>(path, { searchParams: { ...query } });
  },

  setState(mediaItemId: string, state: WatchState, mediaType: MediaType): Promise<UserMediaState> {
    return apiPatch<UserMediaState>(`user-media/${mediaItemId}`, {
      state,
      mediaType,
    } satisfies SetUserMediaState);
  },

  pause(mediaItemId: string): Promise<UserMediaState> {
    return apiPost<UserMediaState>(`user-media/${mediaItemId}/pause`);
  },

  resume(mediaItemId: string): Promise<UserMediaState> {
    return apiPost<UserMediaState>(`user-media/${mediaItemId}/resume`);
  },

  setRating(
    mediaItemId: string,
    rating: number | null,
    mediaType: MediaType,
  ): Promise<UserMediaState | null> {
    return apiPatchOrNull<UserMediaState>(`user-media/${mediaItemId}`, {
      rating,
      mediaType,
    } satisfies SetUserMediaState);
  },

  removeFromLibrary(mediaItemId: string): Promise<void> {
    return apiDelete(`user-media/${mediaItemId}`, { keepalive: true });
  },
} as const;
