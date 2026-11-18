import type { ReactNode } from 'react';
import { SiteFooter } from '@/widgets/footer';
import { SiteHeader } from '@/widgets/header';
import { TranslationScope, getDictionary, type Locale } from '@/shared/i18n';
import { AppShell } from '@/shared/ui';
import { MobileDock } from './mobile-dock';
import { ShellOverlays } from './shell-overlays';

interface ShellLayoutProps {
  locale: Locale;
  children: ReactNode;
}

export function ShellLayout({ locale, children }: ShellLayoutProps) {
  const dict = getDictionary(locale);

  return (
    <TranslationScope
      locale={locale}
      namespaces={[
        'auth',
        'episodes',
        'errorPage',
        'header',
        'media',
        'nav',
        'notFound',
        'notifications',
        'offline',
        'profile',
        'rating',
        'saveToLibrary',
        'search',
        'whatsNew',
      ]}
    >
      <AppShell
        header={<SiteHeader />}
        tabBar={<MobileDock />}
        footer={<SiteFooter dict={dict} />}
        overlays={<ShellOverlays />}
        skipToContentLabel={dict.common.skipToContent}
      >
        {children}
      </AppShell>
    </TranslationScope>
  );
}
