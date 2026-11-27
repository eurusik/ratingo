import {
  FailureReason,
  MAX_WAITING_REQUESTS,
  RequestState,
  STALE_RUNNING_MARGIN_MS,
} from '../constants/request.constants';
import type { InvestigationRecord } from '../entities/investigation-record';

const longestQueueWaitMs = (runTimeoutMs: number): number =>
  runTimeoutMs * (MAX_WAITING_REQUESTS + 1) + STALE_RUNNING_MARGIN_MS;

const isOverdue = (record: InvestigationRecord, nowMs: number, runTimeoutMs: number): boolean => {
  if (record.state === RequestState.RUNNING && record.startedAtMs !== undefined) {
    return nowMs - record.startedAtMs > runTimeoutMs + STALE_RUNNING_MARGIN_MS;
  }
  return (
    record.state === RequestState.QUEUED &&
    nowMs - record.createdAtMs > longestQueueWaitMs(runTimeoutMs)
  );
};

export const interruptedIfStale = (
  record: InvestigationRecord,
  nowMs: number,
  runTimeoutMs: number,
): InvestigationRecord =>
  isOverdue(record, nowMs, runTimeoutMs)
    ? {
        ...record,
        state: RequestState.FAILED,
        reason: FailureReason.INTERRUPTED,
        finishedAtMs: nowMs,
      }
    : record;
