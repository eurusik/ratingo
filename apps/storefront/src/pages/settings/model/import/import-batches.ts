import type { ImportBatch } from '@/shared/api';

export interface BatchProgress {
  source: string;
  done: number;
  total: number;
  batchIds: string[];
}

export type BatchOutcome = 'running' | 'completed' | 'cancelled';

const PROCESSING: ImportBatch['status'] = 'processing';

export function runningProgress(batches: readonly ImportBatch[] | undefined): BatchProgress | undefined {
  const running = batches?.filter((batch) => batch.status === PROCESSING) ?? [];
  const [latest] = [...running].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!latest) return undefined;
  return {
    source: latest.source,
    done: running.reduce((sum, batch) => sum + batch.completedCount + batch.failedCount, 0),
    total: running.reduce((sum, batch) => sum + batch.totalItems, 0),
    batchIds: running.map((batch) => batch.batchId),
  };
}

export function batchOutcome(batch: ImportBatch | undefined): BatchOutcome {
  if (!batch || batch.status === PROCESSING) return 'running';
  return batch.status === 'cancelled' ? 'cancelled' : 'completed';
}

export function isAnyRunning(batches: readonly ImportBatch[] | undefined): boolean {
  return batches?.some((batch) => batch.status === PROCESSING) ?? false;
}
