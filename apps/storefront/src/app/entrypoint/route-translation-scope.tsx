import type { ReactNode } from 'react';
import { TranslationScope, type Namespace } from '@/shared/i18n';
import { getRequestLocale } from './request-locale';

interface RouteTranslationScopeProps {
  namespaces: readonly Namespace[];
  children: ReactNode;
}

export async function RouteTranslationScope({ namespaces, children }: RouteTranslationScopeProps) {
  return (
    <TranslationScope locale={await getRequestLocale()} namespaces={namespaces}>
      {children}
    </TranslationScope>
  );
}
