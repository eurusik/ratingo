'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { userMediaApi, type ImportRequest, type ImportResult } from '@/core/api/user-media.client';
import { queryKeys } from '@/core/query/keys';
import { useTranslation } from '@/shared/i18n';

export type { ImportRequest, ImportResult } from '@/core/api/user-media.client';

export function useImportMedia() {
  const queryClient = useQueryClient();
  const { dict } = useTranslation();

  return useMutation<ImportResult, Error, ImportRequest>({
    mutationFn: (data: ImportRequest) => userMediaApi.importMedia(data),

    onSuccess: () => {
      // Mark as stale but don't refetch now — will refetch when user visits the page.
      // Prevents empty-state flash on /activity caused by aggressive background refetch.
      const opts = { refetchType: 'none' as const };
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.all, ...opts });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.all, ...opts });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.personalizedCalendarAll, ...opts });
      queryClient.invalidateQueries({ queryKey: queryKeys.savedItems.all, ...opts });
    },

    onError: (error) => {
      toast.error(error.message || dict.settings.import.importFailed);
    },
  });
}

export function useCancelImportBatches() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: (batchIds) => userMediaApi.cancelImportBatches(batchIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.importBatchStatus });
    },
  });
}
