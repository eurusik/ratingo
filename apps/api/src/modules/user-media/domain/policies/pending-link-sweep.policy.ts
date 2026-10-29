import {
  LINK_PENDING_IMPORTS_INGEST_TIMEOUT_MS,
  LINK_PENDING_IMPORTS_MIN_AGE_MS,
  LINK_PENDING_IMPORTS_STALE_LINKING_MS,
} from '../constants/import-pending.constants';

export interface PendingLinkSweepCutoffsMs {
  ingestingBefore: number;
  staleLinkingBefore: number;
  ingestTimeoutBefore: number;
}

export function pendingLinkSweepCutoffMs(
  nowMs: number,
  minAgeMs: number = LINK_PENDING_IMPORTS_MIN_AGE_MS,
): number {
  return nowMs - minAgeMs;
}

export function staleLinkingCutoffMs(nowMs: number): number {
  return pendingLinkSweepCutoffMs(nowMs, LINK_PENDING_IMPORTS_STALE_LINKING_MS);
}

export function pendingLinkSweepCutoffsMs(nowMs: number): PendingLinkSweepCutoffsMs {
  return {
    ingestingBefore: pendingLinkSweepCutoffMs(nowMs),
    staleLinkingBefore: staleLinkingCutoffMs(nowMs),
    ingestTimeoutBefore: pendingLinkSweepCutoffMs(nowMs, LINK_PENDING_IMPORTS_INGEST_TIMEOUT_MS),
  };
}
