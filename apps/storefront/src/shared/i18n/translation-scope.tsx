import type { ReactNode } from 'react';
import type { Locale } from '@ratingo/web-core/i18n';
import { getDictionary, type Dictionary } from './dictionaries';
import { I18nProvider } from './i18n-context';

export type Namespace = keyof Dictionary;

export function pickNamespaces<N extends Namespace>(
  dictionary: Dictionary,
  namespaces: readonly N[],
): Pick<Dictionary, N> {
  return Object.fromEntries(
    namespaces.map((namespace) => [namespace, dictionary[namespace]]),
  ) as Pick<Dictionary, N>;
}

interface TranslationScopeProps {
  locale: Locale;
  namespaces: readonly Namespace[];
  children: ReactNode;
}

export function TranslationScope({ locale, namespaces, children }: TranslationScopeProps) {
  return (
    <I18nProvider locale={locale} dictionary={pickNamespaces(getDictionary(locale), namespaces)}>
      {children}
    </I18nProvider>
  );
}
