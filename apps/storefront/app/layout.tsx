import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppProviders, getRequestLocale } from '@/app/entrypoint';
import { configureStorefrontApi } from '@/shared/api';
import { getDictionary } from '@/shared/i18n';
import '@/app/styles/globals.css';

configureStorefrontApi();

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getRequestLocale());

  return {
    title: {
      default: dict.meta.title,
      template: '%s | Ratingo',
    },
    description: dict.meta.description,
    robots: { index: false, follow: false },
    appleWebApp: {
      capable: true,
      title: dict.home.title,
      statusBarStyle: 'black-translucent',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#060607',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <AppProviders locale={locale} dictionary={getDictionary(locale)}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
