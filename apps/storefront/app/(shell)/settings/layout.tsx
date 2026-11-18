import type { ReactNode } from 'react';
import { getRequestLocale } from '@/app/entrypoint';
import { TranslationScope } from '@/shared/i18n';

export default async function SettingsRouteLayout({ children }: { children: ReactNode }) {
  return (
    <TranslationScope locale={await getRequestLocale()} namespaces={['details', 'my', 'settings']}>
      {children}
    </TranslationScope>
  );
}
