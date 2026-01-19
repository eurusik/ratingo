/**
 * Hooks for managing activity lists (watching/completed).
 * Uses React Query for caching.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE } from '@/core/api/me-lists.client';
import { queryKeys } from '@/core/query/keys';

/**
 * Fetch all history items (watching + completed).
 * Used as base for filtering.
 */
function useHistoryBase(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.history,
    queryFn: () => meListsApi.getHistory(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get items currently being watched (state: watching).
 */
export function useWatching(enabled = true) {
  const query = useHistoryBase(enabled);

  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          data: query.data.data.filter((item) => item.state === USER_MEDIA_STATE.WATCHING),
        }
      : undefined,
  };
}

/**
 * Get completed items (state: completed).
 */
export function useCompleted(enabled = true) {
  const query = useHistoryBase(enabled);

  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          data: query.data.data.filter((item) => item.state === USER_MEDIA_STATE.COMPLETED),
        }
      : undefined,
  };
}

// Legacy exports for backwards compatibility
export const useWatchlist = useWatching;
export const useHistory = useCompleted;
