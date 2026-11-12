'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { I18nProvider as AriaI18nProvider, RouterProvider } from '@heroui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@ratingo/ui/theme';
import { AuthProvider } from '@ratingo/web-core/auth';
import { getQueryClient } from '@ratingo/web-core/query';
import { configureStorefrontApi } from '@/shared/api';
import { I18nProvider, type Dictionary, type Locale } from '@/shared/i18n';
import { DeferredToastRegion } from './deferred-toast-region';

configureStorefrontApi();

interface AppProvidersProps {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}

export function AppProviders({ locale, dictionary, children }: AppProvidersProps) {
  const router = useRouter();

  return (
    <ThemeProvider>
      <AriaI18nProvider locale={locale}>
        <RouterProvider navigate={(href) => router.push(href)}>
          <I18nProvider locale={locale} dictionary={dictionary}>
            <QueryClientProvider client={getQueryClient()}>
              <AuthProvider>{children}</AuthProvider>
            </QueryClientProvider>
          </I18nProvider>
          <DeferredToastRegion placement="bottom" />
        </RouterProvider>
      </AriaI18nProvider>
    </ThemeProvider>
  );
}
