import type { components } from '@ratingo/api-contract';
import { apiDelete, apiGet, apiPost } from '@ratingo/web-core/api';

export type ShowProgress = components['schemas']['ShowProgressDto'];
type BatchEpisodeIds = components['schemas']['BatchEpisodeIdsDto'];

const MAX_EPISODE_IDS_PER_REQUEST = 200;

function inBatches<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}

async function postEpisodeIds(path: string, episodeIds: readonly string[]): Promise<void> {
  for (const batch of inBatches(episodeIds, MAX_EPISODE_IDS_PER_REQUEST)) {
    await apiPost<void>(path, { episodeIds: batch } satisfies BatchEpisodeIds);
  }
}

export const episodeProgressApi = {
  getShowProgress(showId: string): Promise<ShowProgress> {
    return apiGet<ShowProgress>(`user-media/shows/${showId}/progress`);
  },

  markWatched(episodeId: string): Promise<void> {
    return apiPost<void>(`user-media/episodes/${episodeId}/watch`);
  },

  markUnwatched(episodeId: string): Promise<void> {
    return apiDelete(`user-media/episodes/${episodeId}/watch`);
  },

  markManyWatched(episodeIds: readonly string[]): Promise<void> {
    return postEpisodeIds('user-media/episodes/batch/watch', episodeIds);
  },

  markManyUnwatched(episodeIds: readonly string[]): Promise<void> {
    return postEpisodeIds('user-media/episodes/batch/unwatch', episodeIds);
  },
} as const;
