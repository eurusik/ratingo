import {
  AlertKey,
  FAILED_RUNS_TO_ALERT,
  failedRunsText,
} from '../constants/watchdog-rules.constants';
import { failing, healthy, type CheckResult } from '../entities/check-result';

export const evaluateFailedRuns = (failedCount: number): CheckResult =>
  failedCount >= FAILED_RUNS_TO_ALERT
    ? failing(AlertKey.FAILED_RUNS, failedRunsText(failedCount))
    : healthy(AlertKey.FAILED_RUNS);
