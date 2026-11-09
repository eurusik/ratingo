/**
 * i18n configuration and types.
 *
 * Centralized translation system that's easy to extend.
 * Currently supports: uk (default), en
 */

import uk from './locales/uk.json';
import en from './locales/en.json';

/** Supported locales. */
export type Locale = 'uk' | 'en';

/** Default locale. */
export const DEFAULT_LOCALE: Locale = 'uk';

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

/**
 * Get nested translation value by dot-path.
 *
 * @param dict - Translation dictionary
 * @param path - Dot-separated path (e.g., "card.cta.details")
 * @returns Translated string or path as fallback
 *
 * @example
 * getByPath(dict, 'card.cta.details') // "Деталі"
 */
export function getByPath(dict: TranslationKeys, path: string): string {
  const keys = path.split('.');
  let result: unknown = dict;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      // Return path as fallback (helps debug missing keys)
      return path;
    }
  }

  return typeof result === 'string' ? result : path;
}
