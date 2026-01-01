'use client';

import { createContext, useContext, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth';
import { userActionsApi, type MediaSaveStatusDto } from '@/core/api/user-actions';
import { queryKeys, createBatchHash } from '@/core/query/keys';

/**
 * Context value for saved status provider.
 */
interface SavedStatusContextValue {
  /** Get save status for a media item from cache. */
  getStatus: (mediaItemId: string) => MediaSaveStatusDto | undefined;
  /** Check if status is loading. */
  isLoading: boolean;
  /** Invalidate cache after save/unsave action. */
  invalidate: () => void;
}

const SavedStatusContext = createContext<SavedStatusContextValue | null>(null);

/**
 * Props for SavedStatusProvider.
 */
interface SavedStatusProviderProps {
  /** Media item IDs to prefetch status for. */
  mediaItemIds: string[];
  children: ReactNode;
}

/**
 * Provider that prefetches save status for multiple media items in a single request.
 * Children can use useSavedStatus() hook to read status from cache.
 *
 * Uses canonical query keys from queryKeys.userActions.savedItems.batch()
 * and populates individual cache entries after batch fetch.
 */
export function SavedStatusProvider({ mediaItemIds, children }: SavedStatusProviderProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Dedupe and filter empty IDs
  const uniqueIds = useMemo(() => [...new Set(mediaItemIds.filter(Boolean))], [mediaItemIds]);

  // Create deterministic batch hash for cache key
  const batchHash = useMemo(() => createBatchHash(uniqueIds), [uniqueIds]);

  // Batch fetch all statuses in one request using canonical key
  const { data: statuses, isLoading } = useQuery({
    queryKey: queryKeys.userActions.savedItems.batch(batchHash),
    queryFn: () => userActionsApi.getBatchSaveStatus(uniqueIds),
    enabled: isAuthenticated && uniqueIds.length > 0,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });

  // Populate individual cache entries after batch fetch
  useEffect(() => {
    if (!statuses) return;

    Object.entries(statuses).forEach(([mediaItemId, status]) => {
      queryClient.setQueryData(queryKeys.userActions.savedItems.status(mediaItemId), status);
    });
  }, [statuses, queryClient]);

  const getStatus = useCallback(
    (mediaItemId: string): MediaSaveStatusDto | undefined => {
      return statuses?.[mediaItemId];
    },
    [statuses],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.userActions.savedItems.batch(batchHash),
    });
    // Also invalidate individual status queries
    uniqueIds.forEach((id) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.status(id),
      });
    });
  }, [queryClient, batchHash, uniqueIds]);

  const value = useMemo(
    () => ({ getStatus, isLoading, invalidate }),
    [getStatus, isLoading, invalidate],
  );

  return <SavedStatusContext.Provider value={value}>{children}</SavedStatusContext.Provider>;
}

/**
 * Hook to access saved status from context.
 * Returns undefined if used outside of SavedStatusProvider.
 */
export function useSavedStatusContext(): SavedStatusContextValue | null {
  return useContext(SavedStatusContext);
}
