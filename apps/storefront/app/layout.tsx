import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from '@/app/entrypoint';
import { configureStorefrontApi } from '@/shared/api';
import { DEFAULT_LOCALE, getDictionary } from '@/shared/i18n';
import '@/app/styles/globals.css';

configureStorefrontApi();

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  themeColor: '#060607',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        <AppProviders locale={DEFAULT_LOCALE} dictionary={dict}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
