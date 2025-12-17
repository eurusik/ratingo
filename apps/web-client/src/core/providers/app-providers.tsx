'use client';

/**
 * Root application providers.
 *
 * Combines all context providers in correct nesting order.
 */

import { ThemeProvider } from 'next-themes';
import NextTopLoader from 'nextjs-toploader';
import { QueryProvider } from './query-provider';
import { I18nProvider, type Locale, DEFAULT_LOCALE } from '@/shared/i18n';

interface AppProvidersProps {
  children: React.ReactNode;
  /** Current locale (defaults to uk). */
  locale?: Locale;
}

/**
 * Wraps application with all necessary providers.
 *
 * Provider order (outer to inner):
 * 1. ThemeProvider - Theme context
 * 2. I18nProvider - Translation context
 * 3. QueryProvider - TanStack Query context
 *
 * @param props - Component props
 * @param props.children - Child components
 * @param props.locale - Current locale
 */
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
          {children}
        </QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
