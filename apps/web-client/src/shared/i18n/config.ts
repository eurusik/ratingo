/**
 * i18n configuration and types.
 *
 * Centralized translation system that's easy to extend.
 * Currently supports: uk (default), en
 */

import uk from './locales/uk.json';
import en from './locales/en.json';
import { DEFAULT_LOCALE, type Locale } from '@ratingo/web-core/i18n';

/** Translation dictionaries by locale. */
const dictionaries: Record<Locale, typeof uk> = {
  uk,
  en,
};

/** Translation keys type (auto-inferred from uk.json). */
export type TranslationKeys = typeof uk;

/**
 * Get translations for a locale.
 *
 * @param locale - Target locale
 * @returns Translation dictionary
 */
export function getDictionary(locale: Locale = DEFAULT_LOCALE): TranslationKeys {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
