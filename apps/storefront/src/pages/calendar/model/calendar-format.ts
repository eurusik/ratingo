import type { Locale } from '@/shared/i18n';
import { SERVICE_TIME_ZONE } from '@/shared/config';
import { capitalizeFirst } from '@/shared/lib';
import { WEEK_LENGTH, addDays, utcMidnight, type DateKey } from './calendar-dates';

const DAY_FORMATS = {
  weekdayShort: { weekday: 'short', timeZone: 'UTC' },
  weekdayLong: { weekday: 'long', timeZone: 'UTC' },
  dayNumber: { day: 'numeric', timeZone: 'UTC' },
  dayMonth: { day: 'numeric', month: 'long', timeZone: 'UTC' },
  weekdayDayMonth: { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

type DayFormat = keyof typeof DAY_FORMATS;

const formats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}:${JSON.stringify(options)}`;
  let format = formats.get(cacheKey);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    formats.set(cacheKey, format);
  }
  return format;
}

export function formatDay(locale: Locale, key: DateKey, style: DayFormat): string {
  return dateFormat(locale, DAY_FORMATS[style]).format(utcMidnight(key));
}

function isSameMonth(left: DateKey, right: DateKey): boolean {
  return left.slice(0, 7) === right.slice(0, 7);
}

function isSameYear(left: DateKey, right: DateKey): boolean {
  return left.slice(0, 4) === right.slice(0, 4);
}

function weekBounds(weekStart: DateKey) {
  const weekEnd = addDays(weekStart, WEEK_LENGTH - 1);
  return { start: utcMidnight(weekStart), end: utcMidnight(weekEnd), weekEnd };
}

export function formatWeekSpan(locale: Locale, weekStart: DateKey): string {
  const { start, end, weekEnd } = weekBounds(weekStart);
  const dayMonth = dateFormat(locale, DAY_FORMATS.dayMonth);
  if (isSameYear(weekStart, weekEnd)) return dayMonth.formatRange(start, end);
  return `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}

export function formatWeekMonths(locale: Locale, weekStart: DateKey): string {
  const { start, end, weekEnd } = weekBounds(weekStart);
  const month = dateFormat(locale, { month: 'short', timeZone: 'UTC' });
  if (isSameMonth(weekStart, weekEnd)) return month.format(start);
  return `${month.format(start)}–${month.format(end)}`;
}

export function formatWeeksAway(locale: Locale, weeks: number): string {
  return capitalizeFirst(
    new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(weeks, 'week'),
  );
}

export function formatReleaseTime(locale: Locale, instant: string): string {
  return dateFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: SERVICE_TIME_ZONE,
  }).format(new Date(instant));
}
