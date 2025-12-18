'use client';

/**
 * Root application providers.
 * Combines theme, i18n, query, and toast providers.
 */

import { ThemeProvider } from 'next-themes';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from 'sonner';
import { QueryProvider } from './query-provider';
import { I18nProvider, type Locale, DEFAULT_LOCALE } from '@/shared/i18n';

interface AppProvidersProps {
  children: React.ReactNode;
  /** Current locale. */
  locale?: Locale;
}

export function AppProviders({ children, locale = DEFAULT_LOCALE }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
      <I18nProvider locale={locale}>
        <QueryProvider>
          <NextTopLoader
            color="#3b82f6"
            height={3}
            showSpinner={false}
            shadow="0 0 10px #3b82f6,0 0 5px #3b82f6"
          />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#fafafa',
              },
            }}
          />
          {children}
        </QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
