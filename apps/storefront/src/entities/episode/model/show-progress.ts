'use client';

import { useMemo } from 'react';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { episodeProgressApi, type ShowProgress } from '@/shared/api';
import { applyWatchChange, watchedEpisodeIds, type WatchChange } from './progress';
import type { Season } from './season';

export const EPISODE_PROGRESS_QUERY_KEY = ['episode-progress'] as const;

function showProgressKey(userId: string | null, showId: string) {
  return [...EPISODE_PROGRESS_QUERY_KEY, userId, showId] as const;
}

function watchMutationKey(showId: string) {
  return [...EPISODE_PROGRESS_QUERY_KEY, 'watch', showId] as const;
}

export interface ShowProgressView {
  watched: ReadonlySet<string>;
  canTrack: boolean;
  isResolving: boolean;
}

export function useShowProgress(showId: string | undefined): ShowProgressView {
  const { user, isAuthenticated, isLoading } = useAuth();
  const userId = user?.id ?? null;
  const canTrack = isAuthenticated && userId !== null && showId !== undefined;
  const { data, isPending } = useQuery({
    queryKey: showProgressKey(userId, showId ?? ''),
    queryFn: canTrack ? () => episodeProgressApi.getShowProgress(showId) : skipToken,
  });
  const watched = useMemo(() => watchedEpisodeIds(data), [data]);

  return {
    watched,
    canTrack: canTrack && data !== undefined,
    isResolving: isLoading || (canTrack && isPending),
  };
}

function sendWatchChange({ episodeIds, watched }: WatchChange): Promise<void> {
  if (episodeIds.length === 1) {
    const [episodeId] = episodeIds;
    return watched
      ? episodeProgressApi.markWatched(episodeId)
      : episodeProgressApi.markUnwatched(episodeId);
  }
  return watched
    ? episodeProgressApi.markManyWatched(episodeIds)
    : episodeProgressApi.markManyUnwatched(episodeIds);
}

interface WatchedShow {
  showId: string;
  seasons?: readonly Season[];
  onSynced?: () => void;
  onFailed?: () => void;
}

type SetWatched = (change: WatchChange) => void;

const NO_SEASONS: readonly Season[] = [];

export function useSetEpisodesWatched({
  showId,
  seasons = NO_SEASONS,
  onSynced,
  onFailed,
}: WatchedShow): SetWatched {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id ?? null;
  const queryKey = showProgressKey(userId, showId);
  const mutationKey = watchMutationKey(showId);

  const { mutate } = useMutation({
    mutationKey,
    scope: { id: mutationKey.join(':') },
    mutationFn: sendWatchChange,
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ShowProgress>(
        queryKey,
        (current) => current && applyWatchChange(current, change, seasons),
      );
    },
    onError: (error, change) => {
      console.error('Saving episode progress failed', { showId, change, error });
      onFailed?.();
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      onSynced?.();
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return (change) => {
    if (change.episodeIds.length > 0) mutate(change);
  };
}
