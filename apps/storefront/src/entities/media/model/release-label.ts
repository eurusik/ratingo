import { SERVICE_TIME_ZONE } from '@/shared/config';
import type { Locale } from '@/shared/i18n';

const dayFormats = new Map<string, Intl.DateTimeFormat>();

function dayFormat(locale: Locale, month: 'short' | 'long', withYear: boolean) {
  const key = `${locale}:${month}:${withYear}`;
  let format = dayFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month,
      year: withYear ? 'numeric' : undefined,
      timeZone: SERVICE_TIME_ZONE,
    });
    dayFormats.set(key, format);
  }
  return format;
}

const yearFormat = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: SERVICE_TIME_ZONE });

function validDate(instant: string): Date | undefined {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatReleaseBadge(locale: Locale, instant: string): string {
  const date = validDate(instant);
  return date ? dayFormat(locale, 'short', false).format(date).replaceAll('.', '') : '';
}

export function formatReleaseDate(locale: Locale, instant: string, now = new Date()): string {
  const date = validDate(instant);
  if (!date) return '';
  const withYear = yearFormat.format(date) !== yearFormat.format(now);
  return dayFormat(locale, 'long', withYear).format(date);
}
