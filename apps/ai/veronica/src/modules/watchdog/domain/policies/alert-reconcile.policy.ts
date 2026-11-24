import { ALERT_KEYS, type AlertKey } from '../constants/watchdog-rules.constants';
import type { CheckResult, Finding } from '../entities/check-result';

export interface Reconciliation {
  raised: Finding[];
  recovered: AlertKey[];
  active: AlertKey[];
}

export const reconcileAlerts = (
  previouslyActive: readonly AlertKey[],
  results: readonly CheckResult[],
): Reconciliation => {
  const before = new Set(previouslyActive);
  const evaluated = new Set(results.map((result) => result.key));
  const failingNow = results.flatMap((result) => (result.finding === null ? [] : [result.finding]));
  const failingKeys = new Set(failingNow.map((finding) => finding.key));
  const active = ALERT_KEYS.filter(
    (key) => failingKeys.has(key) || (before.has(key) && !evaluated.has(key)),
  );
  return {
    raised: failingNow.filter((finding) => !before.has(finding.key)),
    recovered: ALERT_KEYS.filter(
      (key) => before.has(key) && evaluated.has(key) && !failingKeys.has(key),
    ),
    active,
  };
};
