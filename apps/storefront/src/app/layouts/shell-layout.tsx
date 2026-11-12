import type { ReactNode } from 'react';
import { getDictionary, type Locale } from '@/shared/i18n';
import { AppShell } from '@/shared/ui';
import { MobileDock } from './mobile-dock';
import { SiteHeader } from './site-header';

interface ShellLayoutProps {
  locale: Locale;
  children: ReactNode;
}

export function ShellLayout({ locale, children }: ShellLayoutProps) {
  const dict = getDictionary(locale);

  return (
    <AppShell
      header={<SiteHeader />}
      tabBar={<MobileDock />}
      skipToContentLabel={dict.common.skipToContent}
    >
      {children}
    </AppShell>
  );
}
