import { MS_PER_DAY } from '../constants/job-failure.constants';

export const isRetentionDue = (lastPrunedAtMs: number | null, nowMs: number): boolean =>
  lastPrunedAtMs === null || nowMs - lastPrunedAtMs >= MS_PER_DAY;
