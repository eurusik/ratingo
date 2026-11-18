import type { ReactNode } from 'react';
import { getRequestLocale } from '@/app/entrypoint';
import { TranslationScope } from '@/shared/i18n';

export default async function CalendarRouteLayout({ children }: { children: ReactNode }) {
  return (
    <TranslationScope
      locale={await getRequestLocale()}
      namespaces={['calendar', 'details', 'reminder']}
    >
      {children}
    </TranslationScope>
  );
}
