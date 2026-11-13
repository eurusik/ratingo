import { pluralize } from '@ratingo/web-core/lib';
import { interpolate, type Dictionary, type Locale } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';

type DetailsDictionary = Dictionary['details'];

interface PluralForms {
  one: string;
  few: string;
  many: string;
}

const MINUTES_PER_HOUR = 60;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;
const PERCENT_SCALE = 100;

export function formatRuntime(minutes: number, dict: DetailsDictionary): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return interpolate(dict.runtime.minutes, { minutes: rest });
  if (rest === 0) return interpolate(dict.runtime.wholeHours, { hours });
  return interpolate(dict.runtime.hours, { hours, minutes: rest });
}

export function formatCount(count: number, forms: PluralForms, locale: Locale): string {
  return interpolate(pluralize(count, forms, locale), { count });
}

export function formatPercent(percent: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    percent / PERCENT_SCALE,
  );
}

export function formatMoney(amount: number, locale: Locale, dict: DetailsDictionary): string {
  const inBillions = amount >= BILLION;
  const value = amount / (inBillions ? BILLION : MILLION);
  const shown = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return interpolate(inBillions ? dict.money.billions : dict.money.millions, { amount: shown });
}

export function formatDate(isoDate: string, locale: Locale): string | undefined {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function watchingNowLabel(
  dict: Dictionary,
  locale: Locale,
  count: number,
  totalWatchers?: number,
): string {
  const watching = interpolate(pluralize(count, dict.media.watchingNowShort, locale), {
    count: formatCompactCount(locale, count),
  });
  if (totalWatchers === undefined) return interpolate(dict.details.watchingNow, { watching });
  const total = interpolate(dict.details.totalWatchers, {
    count: formatCompactCount(locale, totalWatchers),
  });
  return `${interpolate(dict.details.watchingNowLong, { watching })} · ${total}`;
}
