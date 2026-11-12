'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi, type MediaSaveStatus } from '@/shared/api';
import { createBatchLoader } from '@/shared/lib';

const MAX_IDS_PER_REQUEST = 100;

export const NOT_SAVED: MediaSaveStatus = { isForLater: false, isConsidering: false };

const saveStatusLoader = createBatchLoader(
  (ids) => libraryApi.getSaveStatuses(ids),
  MAX_IDS_PER_REQUEST,
);

function saveStatusKey(mediaItemId: string) {
  return ['library', 'save-status', mediaItemId] as const;
}

export function isSaved(status: MediaSaveStatus): boolean {
  return status.isForLater || status.isConsidering;
}

export function useSaveStatus(mediaItemId: string): MediaSaveStatus {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: saveStatusKey(mediaItemId),
    queryFn: async () => (await saveStatusLoader.load(mediaItemId)) ?? NOT_SAVED,
    enabled: isAuthenticated,
  });
  return isAuthenticated ? (data ?? NOT_SAVED) : NOT_SAVED;
}

export interface LibraryStore {
  read(mediaItemId: string): MediaSaveStatus;
  write(mediaItemId: string, status: MediaSaveStatus): void;
}

export function useLibraryStore(): LibraryStore {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      read: (mediaItemId) =>
        queryClient.getQueryData<MediaSaveStatus>(saveStatusKey(mediaItemId)) ?? NOT_SAVED,
      write: (mediaItemId, status) => {
        const queryKey = saveStatusKey(mediaItemId);
        void queryClient.cancelQueries({ queryKey }, { revert: false });
        queryClient.setQueryData(queryKey, status);
      },
    }),
    [queryClient],
  );
}
