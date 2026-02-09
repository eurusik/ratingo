'use client';

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth';
import { meListsApi } from '@/core/api/me-lists.client';
import { queryKeys, createBatchHash } from '@/core/query/keys';

interface UserRatingContextValue {
  getRating: (mediaItemId: string) => number | undefined;
  isLoading: boolean;
  error: Error | null;
  invalidate: () => void;
}

const UserRatingContext = createContext<UserRatingContextValue | null>(null);

interface UserRatingProviderProps {
  mediaItemIds: string[];
  children: ReactNode;
}

/**
 * Provides a context that batch-fetches and exposes the current user's ratings for the given media items.
 *
 * The provider deduplicates and ignores falsy IDs, fetches ratings only when the user is authenticated and there
 * is at least one ID, and caches results for a short period. The context value exposes `getRating(mediaItemId)`,
 * `isLoading`, `error`, and `invalidate()`.
 *
 * @param mediaItemIds - Array of media item IDs to fetch ratings for; duplicates and falsy values are removed.
 * @param children - React children that will receive the user ratings context.
 * @returns A context provider element that supplies user rating utilities to descendant components.
 */
export function UserRatingProvider({ mediaItemIds, children }: UserRatingProviderProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const uniqueIds = useMemo(() => [...new Set(mediaItemIds.filter(Boolean))], [mediaItemIds]);
  const batchHash = useMemo(() => createBatchHash(uniqueIds), [uniqueIds]);

  const { data: ratings, isLoading, error } = useQuery({
    queryKey: queryKeys.userMedia.batchRatings(batchHash),
    queryFn: () => meListsApi.getBatchRatings(uniqueIds),
    enabled: isAuthenticated && uniqueIds.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const getRating = useCallback(
    (mediaItemId: string): number | undefined => ratings?.[mediaItemId],
    [ratings],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.batchRatingsAll }),
    [queryClient],
  );

  const value = useMemo(
    () => ({ getRating, isLoading, error, invalidate }),
    [getRating, isLoading, error, invalidate],
  );

  return <UserRatingContext.Provider value={value}>{children}</UserRatingContext.Provider>;
}

/**
 * Accesses the current user rating context value.
 *
 * @returns The current `UserRatingContextValue`, or `null` if no `UserRatingProvider` is mounted.
 */
export function useUserRatingContext(): UserRatingContextValue | null {
  return useContext(UserRatingContext);
}