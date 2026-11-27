import {
  FailureReason,
  MAX_WAITING_REQUESTS,
  RequestState,
  SNAPSHOT_PHASE_ALLOWANCE_MS,
  STALE_RUNNING_MARGIN_MS,
} from '../constants/request.constants';
import type { InvestigationRecord } from '../entities/investigation-record';

const longestRunMs = (runTimeoutMs: number): number =>
  SNAPSHOT_PHASE_ALLOWANCE_MS + runTimeoutMs + STALE_RUNNING_MARGIN_MS;

const longestQueueWaitMs = (runTimeoutMs: number): number =>
  longestRunMs(runTimeoutMs) * (MAX_WAITING_REQUESTS + 1);

const isRunningTooLong = (
  record: InvestigationRecord,
  nowMs: number,
  runTimeoutMs: number,
): boolean => {
  if (record.runStartedAtMs !== undefined) {
    return nowMs - record.runStartedAtMs > runTimeoutMs + STALE_RUNNING_MARGIN_MS;
  }
  return (
    record.startedAtMs !== undefined && nowMs - record.startedAtMs > SNAPSHOT_PHASE_ALLOWANCE_MS
  );
};

const isOverdue = (record: InvestigationRecord, nowMs: number, runTimeoutMs: number): boolean => {
  if (record.state === RequestState.RUNNING) return isRunningTooLong(record, nowMs, runTimeoutMs);
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
