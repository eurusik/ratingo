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
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.personalizedCalendarAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.savedItems.all });
    },

    onError: (error) => {
      console.error('[useImportMedia] Import failed:', error);
      toast.error(error.message || dict.settings.import.importFailed);
    },
  });
}
