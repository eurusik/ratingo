'use client';

import { useQuery } from '@tanstack/react-query';
import { userMediaApi, type ImportBatchStatus } from '@/core/api/user-media.client';
import { queryKeys } from '@/core/query/keys';

export type { ImportBatchStatus } from '@/core/api/user-media.client';

interface UseImportBatchStatusOptions {
  /** Set to false to skip fetching entirely (e.g. no pending batch exists). */
  enabled?: boolean;
}

export function useImportBatchStatus({ enabled = true }: UseImportBatchStatusOptions = {}) {
  return useQuery<ImportBatchStatus[]>({
    queryKey: queryKeys.userMedia.importBatchStatus,
    queryFn: () => userMediaApi.getImportStatus(),
    enabled,
    refetchInterval: (query) => {
      if (query.state.error) return 30_000; // back off on error
      const data = query.state.data;
      // Stop polling when all batches are completed
      if (data?.every((b) => b.status === 'completed')) return false;
      return 5_000;
    },
    retry: 3,
  });
}
