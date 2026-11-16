import { pluralize } from '@ratingo/web-core/lib';
import { interpolate } from './interpolate';

export interface PluralForms {
  one: string;
  few: string;
  many: string;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

export function formatNumber(locale: string, value: number): string {
  let format = numberFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    numberFormats.set(locale, format);
  }
  return format.format(value);
}

export function formatCount(count: number, forms: PluralForms, locale: string): string {
  return interpolate(pluralize(count, forms, locale), { count: formatNumber(locale, count) });
}
