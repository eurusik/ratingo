import { DIGEST_DEADLINE_MINUTES_OF_DAY } from '../constants/watchdog-rules.constants';
import { AlertKey, digestMissingText } from '../constants/watchdog-rules.constants';
import { failing, healthy, type CheckResult } from '../entities/check-result';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kyiv',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const MINUTES_PER_HOUR = 60;

export const kyivMinutesOfDay = (epochMs: number): number => {
  const parts = Object.fromEntries(
    formatter.formatToParts(epochMs).map((part) => [part.type, Number(part.value)]),
  );
  return (parts.hour ?? 0) * MINUTES_PER_HOUR + (parts.minute ?? 0);
};

export const isPastDigestDeadline = (nowMs: number): boolean =>
  kyivMinutesOfDay(nowMs) >= DIGEST_DEADLINE_MINUTES_OF_DAY;

export const evaluateDigest = (nowMs: number, deliveredToday: boolean): CheckResult | null => {
  if (deliveredToday) return healthy(AlertKey.DIGEST_MISSING);
  return isPastDigestDeadline(nowMs) ? failing(AlertKey.DIGEST_MISSING, digestMissingText()) : null;
};
