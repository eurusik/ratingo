import type { AlertKey } from '../constants/watchdog-rules.constants';

export interface Finding {
  key: AlertKey;
  text: string;
}

export interface CheckResult {
  key: AlertKey;
  finding: Finding | null;
}

export const healthy = (key: AlertKey): CheckResult => ({ key, finding: null });

export const failing = (key: AlertKey, text: string): CheckResult => ({
  key,
  finding: { key, text },
});
