'use client';

import { useMemo } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi, type LibraryCounts } from '@/shared/api';
import { LIBRARY_COUNTS_KEY, LIBRARY_LISTS_KEY } from './library-keys';
import { applyMove, type LibraryMove } from './library-lists';

const COUNTS_STALE_MS = 60 * 1000;

export function useLibraryCounts(): LibraryCounts | undefined {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: LIBRARY_COUNTS_KEY,
    queryFn: () => libraryApi.getCounts(),
    enabled: isAuthenticated,
    staleTime: COUNTS_STALE_MS,
    placeholderData: keepPreviousData,
  });
  return isAuthenticated ? data : undefined;
}

export interface LibraryListsStore {
  move(move: LibraryMove): void;
  refresh(): Promise<void>;
}

export function useLibraryListsStore(): LibraryListsStore {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      move: (move) =>
        queryClient.setQueryData<LibraryCounts>(
          LIBRARY_COUNTS_KEY,
          (counts) => counts && applyMove(counts, move),
        ),
      refresh: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: LIBRARY_LISTS_KEY }),
          queryClient.invalidateQueries({ queryKey: LIBRARY_COUNTS_KEY }),
        ]);
      },
    }),
    [queryClient],
  );
}
