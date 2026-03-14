import type { Locale } from '@/shared/i18n';

/**
 * Formats a number using the given locale.
 *
 * Centralises all `new Intl.NumberFormat(locale).format(n)` calls so the
 * locale string is defined in one place and can be driven by the i18n context.
 */
export function formatNumber(n: number, locale: Locale = 'uk'): string {
  return new Intl.NumberFormat(locale).format(n);
}
