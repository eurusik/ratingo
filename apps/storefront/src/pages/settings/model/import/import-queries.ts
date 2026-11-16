'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { LIBRARY_QUERY_KEY } from '@/entities/library';
import { mediaImportApi, type ImportBatch, type MediaImportResult } from '@/shared/api';
import { isAnyRunning } from './import-batches';
import { toImportItemDto, type ImportItem } from './import-item';
import type { ImportSource } from './import-sources';
import { rememberImport } from './last-import';

const POLL_MS = 5000;
const ERROR_BACKOFF_MS = 30_000;
const BATCH_RETRIES = 3;

function importBatchesKey(userId: string | null) {
  return ['media-import', 'batches', userId] as const;
}

export function useImportBatches() {
  const { user } = useAuth();
  return useQuery<ImportBatch[]>({
    queryKey: importBatchesKey(user?.id ?? null),
    queryFn: () => mediaImportApi.getBatches(),
    enabled: Boolean(user),
    retry: BATCH_RETRIES,
    refetchInterval: (query) => {
      if (query.state.error) return ERROR_BACKOFF_MS;
      return isAnyRunning(query.state.data) ? POLL_MS : false;
    },
  });
}

export function useCancelImport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (batchIds: readonly string[]) => mediaImportApi.cancelBatches(batchIds),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: importBatchesKey(user?.id ?? null) }),
  });
}

interface ImportRequest {
  source: ImportSource;
  items: readonly ImportItem[];
  overwrite: boolean;
}

export function useImportMedia() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation<MediaImportResult, Error, ImportRequest>({
    mutationFn: ({ source, items, overwrite }) =>
      mediaImportApi.importMedia({
        source,
        items: items.map(toImportItemDto),
        overwriteExisting: overwrite,
      }),
    onSuccess: (result, { source }) => {
      if (user) rememberImport({ userId: user.id, source, result, finishedAt: Date.now() });
      void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: importBatchesKey(user?.id ?? null) });
    },
  });
}
