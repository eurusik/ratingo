'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locale';
import { getByPath } from './translate';

export interface I18nContextValue<Dictionary extends object> {
  locale: Locale;
  dict: Dictionary;
  t: (path: string) => string;
}

export interface I18nProviderProps {
  locale?: Locale;
  children: ReactNode;
}

export function createI18n<Dictionary extends object>(getDictionary: (locale: Locale) => Dictionary) {
  const I18nContext = createContext<I18nContextValue<Dictionary> | null>(null);

  function I18nProvider({ locale = DEFAULT_LOCALE, children }: I18nProviderProps) {
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
