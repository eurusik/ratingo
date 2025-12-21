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

export function utcDateFromDayId(dayId: string): Date {
  if (!/^[0-9]{8}$/.test(dayId)) {
    throw new Error(`Invalid dayId: ${dayId}`);
  }

  const year = parseInt(dayId.slice(0, 4), 10);
  const month = parseInt(dayId.slice(4, 6), 10) - 1;
  const day = parseInt(dayId.slice(6, 8), 10);
  return new Date(Date.UTC(year, month, day));
}
