import { DEFAULT_LOCALE, type Locale } from '@ratingo/web-core/i18n';
import en from './locales/en.json';
import uk from './locales/uk.json';

export type Dictionary = typeof uk;

const dictionaries: Record<Locale, Dictionary> = { uk, en };

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale];
}
