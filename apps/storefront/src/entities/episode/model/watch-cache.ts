'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const EPISODE_PROGRESS_QUERY_KEY = ['episode-progress'] as const;

export const CALENDAR_QUERY_KEY = ['calendar'] as const;

export function useRefreshWatchProgress(): () => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: EPISODE_PROGRESS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }),
    ]);
  }, [queryClient]);
}
