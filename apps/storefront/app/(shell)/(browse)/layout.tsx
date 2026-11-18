import type { ReactNode } from 'react';
import { getRequestLocale } from '@/app/entrypoint';
import { TranslationScope } from '@/shared/i18n';

export default async function BrowseScopeLayout({ children }: { children: ReactNode }) {
  return (
    <TranslationScope locale={await getRequestLocale()} namespaces={['browse']}>
      {children}
    </TranslationScope>
  );
}
