'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale } from './locale';
import { getByPath } from './translate';

export interface I18nContextValue<Dictionary extends object> {
  locale: Locale;
  dict: Dictionary;
  t: (path: string) => string;
}

export interface I18nProviderProps<Dictionary extends object> {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}

export function createI18n<Dictionary extends object>() {
  const I18nContext = createContext<I18nContextValue<Dictionary> | null>(null);

  function I18nProvider({ locale, dictionary, children }: I18nProviderProps<Dictionary>) {
    const value = useMemo(
      () => ({
        locale,
        dict: dictionary,
        t: (path: string) => getByPath(dictionary, path),
      }),
      [locale, dictionary],
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
  }

  function useTranslation(): I18nContextValue<Dictionary> {
    const context = useContext(I18nContext);

    if (!context) {
      throw new Error('useTranslation must be used within I18nProvider');
    }

    return context;
  }

  function useLocale(): Locale {
    const { locale } = useTranslation();
    return locale;
  }

  return { I18nProvider, useTranslation, useLocale };
}
