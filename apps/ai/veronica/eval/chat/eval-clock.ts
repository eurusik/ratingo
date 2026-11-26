import { formatKyivDateTime } from '../../src/modules/chat/domain/policies/kyiv-time.policy';
import { kyivDateOf } from '../../src/modules/digest/public';

export const EVAL_NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const KYIV_DATE_LENGTH = 'YYYY-MM-DD'.length;
const DATE_TIME_SEPARATOR_LENGTH = 1;

const spokenDayFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: 'numeric',
  month: 'long',
});

const shiftedMs = (minutesFromNow: number): number => EVAL_NOW_MS + minutesFromNow * MS_PER_MINUTE;
const minutesIn = (days: number): number => days * HOURS_PER_DAY * MINUTES_PER_HOUR;

export const kyivTimeFromEvalNow = (hours: number, minutes = 0): string =>
  formatKyivDateTime(shiftedMs(hours * MINUTES_PER_HOUR + minutes));

export const kyivDayFromEvalNow = (days: number): string => kyivDateOf(shiftedMs(minutesIn(days)));

export const clockTimeOf = (kyivDateTime: string): string =>
  kyivDateTime.slice(KYIV_DATE_LENGTH + DATE_TIME_SEPARATOR_LENGTH);

export const spokenKyivDayFromEvalNow = (days: number): string =>
  spokenDayFormatter.format(shiftedMs(minutesIn(days)));
