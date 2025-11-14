/**
 * Зчитує цілий параметр з `URLSearchParams` з межами `min/max`.
 */
export function getIntParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number {
  const raw = searchParams.get(name);
  const parsed = raw !== null ? parseInt(raw, 10) : defaultValue;
  let val = Number.isFinite(parsed) ? parsed : defaultValue;
  if (options?.min !== undefined) val = Math.max(options.min, val);
  if (options?.max !== undefined) val = Math.min(options.max, val);
  return val;
}

/**
 * Зчитує рядковий параметр з нормалізацією (`trim/lower/upper`).
 */
export function getStringParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: string,
  options?: { lower?: boolean; upper?: boolean; trim?: boolean }
): string {
  let val = searchParams.get(name) ?? defaultValue;
  if (options?.trim) val = val.trim();
  if (options?.lower) val = val.toLowerCase();
  if (options?.upper) val = val.toUpperCase();
  return val;
}

/**
 * Зчитує необов’язковий рядковий параметр; повертає `null`, якщо порожній.
 */
export function getOptionalStringParam(
  searchParams: URLSearchParams,
  name: string,
  options?: { lower?: boolean; upper?: boolean; trim?: boolean }
): string | null {
  let val = searchParams.get(name);
  if (val == null) return null;
  if (options?.trim) val = val.trim();
  if (options?.lower) val = val.toLowerCase();
  if (options?.upper) val = val.toUpperCase();
  return val || null;
}

/**
 * Обчислює вікно днів для фільтрації: `{ days, updatedAfter }`.
 */
export function getDaysWindow(
  searchParams: URLSearchParams,
  name: string,
  defaultDays = 0
): { days: number; updatedAfter: Date | null } {
  const raw = searchParams.get(name);
  const parsed = raw !== null ? parseInt(raw, 10) : defaultDays;
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const updatedAfter = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
  return { days, updatedAfter };
}