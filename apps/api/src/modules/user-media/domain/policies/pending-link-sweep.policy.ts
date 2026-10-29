import { LINK_PENDING_IMPORTS_MIN_AGE_MS } from '../constants/import-pending.constants';

export function pendingLinkSweepCutoffMs(
  nowMs: number,
  minAgeMs: number = LINK_PENDING_IMPORTS_MIN_AGE_MS,
): number {
  return nowMs - minAgeMs;
}
