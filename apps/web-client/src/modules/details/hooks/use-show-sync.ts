import { useMutation } from '@tanstack/react-query';

import { catalogApi, type SyncRequestResponseDto } from '@/core/api/catalog.client';

export function useShowSync(slug: string) {
  return useMutation({
    mutationFn: () => catalogApi.requestShowSync(slug),
  });
}
