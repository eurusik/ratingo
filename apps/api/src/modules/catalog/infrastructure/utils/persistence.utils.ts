/**
 * Shared utilities for persistence mappers.
 * Used to transform domain objects to Drizzle insert/update payloads.
 */

/**
 * Filters out undefined values from an object.
 * Prevents "No values to set" error in Drizzle upserts.
 *
 * @param obj Object with potentially undefined values
 * @returns Object with only defined values
 */
export const pickDefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/**
 * Converts a date value to Date object or null.
 * Handles string dates (from JSON) and Date objects.
 *
 * @param value Date, ISO string, null, or undefined
 * @returns Date object or null
 */
export function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}
