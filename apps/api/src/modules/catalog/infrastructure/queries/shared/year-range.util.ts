import { type SQL, gte, lt, isNotNull } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Builds a Date for the start of a given year (January 1st, 00:00:00 UTC).
 */
export function buildYearStart(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

/**
 * Builds a date range for a single year (inclusive start, exclusive end).
 * @param year - The year to build range for
 * @returns Object with start (Jan 1) and end (Jan 1 of next year)
 */
export function buildYearRange(year: number): { start: Date; end: Date } {
  const start = buildYearStart(year);
  const end = buildYearStart(year + 1);
  return { start, end };
}

/**
 * Builds SQL conditions for year-based filtering.
 *
 * Handles three cases:
 * - `year` is set: filter for exact year (Jan 1 to Dec 31)
 * - `yearFrom`/`yearTo` are set: filter for year range
 * - Neither set: returns empty array
 *
 * @param releaseDateColumn - The column to filter on
 * @param year - Single year filter (exclusive with yearFrom/yearTo)
 * @param yearFrom - Start of year range (inclusive)
 * @param yearTo - End of year range (inclusive)
 * @returns Array of SQL conditions to add to WHERE clause
 */
export function buildYearConditions(
  releaseDateColumn: PgColumn,
  year?: number,
  yearFrom?: number,
  yearTo?: number,
): SQL[] {
  const conditions: SQL[] = [];

  if (year !== undefined) {
    const { start, end } = buildYearRange(year);
    conditions.push(
      isNotNull(releaseDateColumn),
      gte(releaseDateColumn, start),
      lt(releaseDateColumn, end),
    );
  } else if (yearFrom !== undefined || yearTo !== undefined) {
    conditions.push(isNotNull(releaseDateColumn));
    if (yearFrom !== undefined) {
      const start = buildYearStart(yearFrom);
      conditions.push(gte(releaseDateColumn, start));
    }
    if (yearTo !== undefined) {
      const end = buildYearStart(yearTo + 1);
      conditions.push(lt(releaseDateColumn, end));
    }
  }

  return conditions;
}
