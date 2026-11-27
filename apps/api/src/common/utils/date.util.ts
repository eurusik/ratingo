import { MS_PER_DAY } from '@/common/constants';

/**
 * Formats a date as a UTC day identifier string (YYYYMMDD).
 * Used for generating consistent cache keys and job IDs.
 *
 * @param date - Date to format (defaults to now)
 * @returns String in YYYYMMDD format (e.g., "20231221")
 */
export function formatUtcDayId(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

const ISO_HOUR_PREFIX_LENGTH = 13; // YYYY-MM-DDTHH

/**
 * Formats a date as a UTC hour bucket identifier string (YYYYMMDDHH).
 * Used for per-dispatch-window job IDs.
 *
 * @param date - Date to format (defaults to now)
 * @returns String in YYYYMMDDHH format (e.g., "2023122119")
 */
export function formatUtcHourId(date: Date = new Date()): string {
  return date.toISOString().slice(0, ISO_HOUR_PREFIX_LENGTH).replace(/[-T]/g, '');
}

export function utcDateFromDayId(dayId: string): Date {
  if (!/^[0-9]{8}$/.test(dayId)) {
    throw new Error(`Invalid dayId: ${dayId}`);
  }

  const year = parseInt(dayId.slice(0, 4), 10);
  const month = parseInt(dayId.slice(4, 6), 10) - 1;
  const day = parseInt(dayId.slice(6, 8), 10);
  return new Date(Date.UTC(year, month, day));
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

const ISO_CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_DATE_MIDDAY_UTC = 'T12:00:00.000Z';

export function middayUtcOfCalendarDate(calendarDate: string): Date {
  return ISO_CALENDAR_DATE.test(calendarDate)
    ? new Date(`${calendarDate}${CALENDAR_DATE_MIDDAY_UTC}`)
    : new Date(calendarDate);
}
