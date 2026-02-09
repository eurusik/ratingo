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
 * Provider that batch-fetches user ratings for multiple media items.
 * Mirrors SavedStatusProvider pattern.
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

export function useUserRatingContext(): UserRatingContextValue | null {
  return useContext(UserRatingContext);
}
