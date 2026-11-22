import {
  AlertKey,
  HAPPY_FAILURES_TO_ALERT,
  WATCHDOG_INTERVAL_MINUTES,
  happyDownText,
} from '../constants/watchdog-rules.constants';
import { failing, healthy, type CheckResult } from '../entities/check-result';
import { HappyProbe } from '../entities/happy-probe';

export const nextHappyFailures = (previousFailures: number, probe: HappyProbe): number =>
  probe === HappyProbe.DOWN ? previousFailures + 1 : 0;

export const evaluateHappy = (failures: number, probe: HappyProbe): CheckResult | null => {
  if (probe === HappyProbe.SKIPPED) return null;
  return failures >= HAPPY_FAILURES_TO_ALERT
    ? failing(AlertKey.HAPPY_DOWN, happyDownText(failures * WATCHDOG_INTERVAL_MINUTES))
    : healthy(AlertKey.HAPPY_DOWN);
};
