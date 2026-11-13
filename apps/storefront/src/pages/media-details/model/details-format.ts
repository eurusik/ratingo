import { pluralize } from '@ratingo/web-core/lib';
import { interpolate, type Dictionary, type Locale } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';

type DetailsDictionary = Dictionary['details'];
type PluralForms = DetailsDictionary['seasons'];

const MINUTES_PER_HOUR = 60;

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

export function formatCompactPeople(count: number, forms: PluralForms, locale: Locale): string {
  return interpolate(pluralize(count, forms, locale), { count: formatCompactCount(locale, count) });
}

const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

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
