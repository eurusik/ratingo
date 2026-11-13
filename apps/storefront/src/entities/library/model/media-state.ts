'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi, type UserMediaState } from '@/shared/api';
import { mediaStateKey, ownScoreKey } from './library-keys';

export interface MediaStateView {
  mediaState: UserMediaState | null;
  isResolving: boolean;
}

export function useMediaState(mediaItemId: string): MediaStateView {
  const { isAuthenticated, isLoading } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: mediaStateKey(mediaItemId),
    queryFn: () => libraryApi.getMediaState(mediaItemId),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return { mediaState: null, isResolving: isLoading };
  return { mediaState: data ?? null, isResolving: isPending };
}

export interface MediaStateStore {
  read(mediaItemId: string): UserMediaState | null;
  write(mediaItemId: string, mediaState: UserMediaState | null): void;
  refresh(mediaItemId: string): void;
}

export function useMediaStateStore(): MediaStateStore {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      read: (mediaItemId) =>
        queryClient.getQueryData<UserMediaState | null>(mediaStateKey(mediaItemId)) ?? null,
      write: (mediaItemId, mediaState) => {
        void queryClient.cancelQueries({ queryKey: mediaStateKey(mediaItemId) }, { revert: false });
        queryClient.setQueryData(mediaStateKey(mediaItemId), mediaState);
        queryClient.setQueryData(ownScoreKey(mediaItemId), mediaState?.rating ?? null);
      },
      refresh: (mediaItemId) => {
        void queryClient.invalidateQueries({ queryKey: mediaStateKey(mediaItemId) });
      },
    }),
    [queryClient],
  );
}
