/**
 * i18n module exports.
 *
 * Provides translation utilities for both server and client components.
 */

// Config and utilities
export {
  type Locale,
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  getDictionary,
  getByPath,
  createTranslator,
  type TranslationKeys,
} from './config';

// React context and hooks
export { I18nProvider, useTranslation, useLocale } from './context';
