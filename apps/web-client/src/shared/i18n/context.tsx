/**
 * Translation context and hooks for React components.
 *
 * Provides useTranslation hook that reads locale from context.
 * Server components can use createTranslator directly.
 */

'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  type Locale,
  DEFAULT_LOCALE,
  getDictionary,
  getByPath,
  type TranslationKeys,
} from './config';

interface I18nContextValue {
  /** Current locale. */
  locale: Locale;
  /** Translation dictionary. */
  dict: TranslationKeys;
  /** Translate by path. */
  t: (path: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  /** Current locale. */
  locale?: Locale;
  /** React children. */
  children: ReactNode;
}

/**
 * Provider for translation context.
 *
 * Wrap your app to enable useTranslation hook.
 *
 * @example
 * <I18nProvider locale="uk">
 *   <App />
 * </I18nProvider>
 */
export function I18nProvider({ locale = DEFAULT_LOCALE, children }: I18nProviderProps) {
  const value = useMemo(() => {
    const dict = getDictionary(locale);
    return {
      locale,
      dict,
      t: (path: string) => getByPath(dict, path),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook to access translations in client components.
 *
 * @returns Translation context with t() function
 * @throws If used outside I18nProvider
 *
 * @example
 * function MyComponent() {
 *   const { t } = useTranslation();
 *   return <button>{t('card.cta.save')}</button>;
 * }
 */
export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }

  return context;
}

/**
 * Hook to get current locale.
 *
 * @returns Current locale code
 */
export function useLocale(): Locale {
  const { locale } = useTranslation();
  return locale;
}
