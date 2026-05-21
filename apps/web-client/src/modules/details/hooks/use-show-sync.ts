import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { catalogApi, type SyncRequestResponseDto } from '@/core/api/catalog.client';

export function useShowSync(slug: string) {
  const router = useRouter();

  return useMutation({
    mutationFn: () => catalogApi.requestShowSync(slug),
    onSuccess: (data: SyncRequestResponseDto) => {
      if (data.queued) {
        // Refresh the server component so lastSyncedAt reflects the new value after sync completes
        router.refresh();
      }
    },
  });
}
