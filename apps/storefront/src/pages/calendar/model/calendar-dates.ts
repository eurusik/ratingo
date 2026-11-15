import { SERVICE_TIME_ZONE } from '@/shared/config';

export const WEEK_LENGTH = 7;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_YEAR = 2000;
const LATEST_YEAR = 2100;

export type DateKey = string;

const kyivParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

function partsOf(instant: Date | string): Record<string, string> {
  return Object.fromEntries(
    kyivParts.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
}

export function utcMidnight(key: DateKey): Date {
  return new Date(`${key}T00:00:00Z`);
}

function isInSupportedYears(key: DateKey): boolean {
  const year = utcMidnight(key).getUTCFullYear();
  return year >= EARLIEST_YEAR && year <= LATEST_YEAR;
}

export function isDateKey(value: string): value is DateKey {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const date = utcMidnight(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function kyivDateKey(instant: Date | string): DateKey {
  const { year, month, day } = partsOf(instant);
  return `${year}-${month}-${day}`;
}

export function kyivHour(instant: string): number {
  return Number(partsOf(instant).hour);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = utcMidnight(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekStartOf(key: DateKey): DateKey {
  const mondayBased = (utcMidnight(key).getUTCDay() + 6) % WEEK_LENGTH;
  return addDays(key, -mondayBased);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function weeksBetween(fromWeekStart: DateKey, toWeekStart: DateKey): number {
  const days = (utcMidnight(toWeekStart).getTime() - utcMidnight(fromWeekStart).getTime()) / DAY_MS;
  return Math.round(days / WEEK_LENGTH);
}

export function weeksFromToday(today: DateKey, weekStart: DateKey): number {
  return weeksBetween(weekStartOf(today), weekStart);
}

export function weekDays(weekStart: DateKey): DateKey[] {
  return Array.from({ length: WEEK_LENGTH }, (_, index) => addDays(weekStart, index));
}

export function isSupportedWeek(weekStart: DateKey): boolean {
  const weekEnd = addDays(weekStart, WEEK_LENGTH);
  return (
    isDateKey(weekStart) &&
    isDateKey(weekEnd) &&
    isInSupportedYears(weekStart) &&
    isInSupportedYears(weekEnd)
  );
}
