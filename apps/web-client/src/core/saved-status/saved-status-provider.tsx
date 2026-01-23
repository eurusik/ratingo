'use client';

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth';
import { userActionsApi, type MediaSaveStatusDto } from '@/core/api/user-actions.client';
import { queryKeys, createBatchHash } from '@/core/query/keys';

interface SavedStatusContextValue {
  getStatus: (mediaItemId: string) => MediaSaveStatusDto | undefined;
  isLoading: boolean;
  error: Error | null;
  invalidate: () => void;
}

const SavedStatusContext = createContext<SavedStatusContextValue | null>(null);

interface SavedStatusProviderProps {
  mediaItemIds: string[];
  children: ReactNode;
}

/**
 * Provider that prefetches save status for multiple media items in a single batch request.
 * Mutations should use updateBatchCache() to apply optimistic updates.
 */
export function SavedStatusProvider({ mediaItemIds, children }: SavedStatusProviderProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const uniqueIds = useMemo(() => [...new Set(mediaItemIds.filter(Boolean))], [mediaItemIds]);
  const batchHash = useMemo(() => createBatchHash(uniqueIds), [uniqueIds]);

  const {
    data: statuses,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.userActions.savedItems.batch(batchHash),
    queryFn: () => userActionsApi.getBatchSaveStatus(uniqueIds),
    enabled: isAuthenticated && uniqueIds.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const getStatus = useCallback(
    (mediaItemId: string): MediaSaveStatusDto | undefined => statuses?.[mediaItemId],
    [statuses],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.userActions.savedItems.batch(batchHash),
    });
  }, [queryClient, batchHash]);

  const value = useMemo(
    () => ({ getStatus, isLoading, error: error as Error | null, invalidate }),
    [getStatus, isLoading, error, invalidate],
  );

  return <SavedStatusContext.Provider value={value}>{children}</SavedStatusContext.Provider>;
}

export function useSavedStatusContext(): SavedStatusContextValue | null {
  return useContext(SavedStatusContext);
}

/**
 * Updates all batch caches with new status for a media item.
 * Call this from mutations to apply optimistic updates.
 */
export function updateBatchCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  mediaItemId: string,
  status: MediaSaveStatusDto,
) {
  queryClient.setQueriesData<Record<string, MediaSaveStatusDto>>(
    { queryKey: ['user-actions', 'saved-items', 'batch'] },
    (oldData) => {
      if (!oldData || !(mediaItemId in oldData)) return oldData;
      return { ...oldData, [mediaItemId]: status };
    },
  );
}
