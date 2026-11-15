import type { Locale } from '@/shared/i18n';

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const SERVICE_TIME_ZONE = 'Europe/Kyiv';

const relativeFormats = new Map<Locale, Intl.RelativeTimeFormat>();
const dateFormats = new Map<Locale, Intl.DateTimeFormat>();

function cached<T>(formats: Map<Locale, T>, locale: Locale, create: () => T): T {
  let format = formats.get(locale);
  if (!format) {
    format = create();
    formats.set(locale, format);
  }
  return format;
}

export function formatFullDate(date: string, locale: Locale): string {
  const time = Date.parse(date);
  if (Number.isNaN(time)) return '';
  return cached(
    dateFormats,
    locale,
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: SERVICE_TIME_ZONE,
      }),
  ).format(time);
}

export function formatRelativeTime(
  date: string,
  now: number,
  locale: Locale,
  justNow: string,
): string {
  const elapsedSeconds = Math.max(0, (now - Date.parse(date)) / 1000);
  if (!Number.isFinite(elapsedSeconds)) return formatFullDate(date, locale);
  const unit = UNITS.find(([, seconds]) => elapsedSeconds >= seconds);
  if (!unit) return justNow;
  const [name, seconds] = unit;
  return cached(
    relativeFormats,
    locale,
    () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
  ).format(-Math.floor(elapsedSeconds / seconds), name);
}
