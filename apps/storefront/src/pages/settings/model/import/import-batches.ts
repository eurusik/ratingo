import type { ImportBatch } from '@/shared/api';

export interface BatchProgress {
  source: string;
  done: number;
  total: number;
  batchIds: string[];
}

type BatchOutcome = 'running' | 'completed' | 'cancelled' | 'unknown';

const PROCESSING: ImportBatch['status'] = 'processing';

export function runningProgress(
  batches: readonly ImportBatch[] | undefined,
): BatchProgress | undefined {
  const running = batches?.filter((batch) => batch.status === PROCESSING) ?? [];
  if (running.length === 0) return undefined;
  const latest = running.reduce((newest, batch) =>
    batch.createdAt > newest.createdAt ? batch : newest,
  );
  return {
    source: latest.source,
    done: running.reduce((sum, batch) => sum + batch.completedCount + batch.failedCount, 0),
    total: running.reduce((sum, batch) => sum + batch.totalItems, 0),
    batchIds: running.map((batch) => batch.batchId),
  };
}

export function batchOutcome(
  batches: readonly ImportBatch[] | undefined,
  batchId: string,
): BatchOutcome {
  if (!batches) return 'running';
  const batch = batches.find((candidate) => candidate.batchId === batchId);
  if (!batch) return 'unknown';
  if (batch.status === PROCESSING) return 'running';
  return batch.status === 'cancelled' ? 'cancelled' : 'completed';
}

export function isAnyRunning(batches: readonly ImportBatch[] | undefined): boolean {
  return batches?.some((batch) => batch.status === PROCESSING) ?? false;
}
