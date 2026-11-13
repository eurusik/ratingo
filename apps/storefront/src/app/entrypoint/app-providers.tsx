'use client';

import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@ratingo/web-core/auth';
import { getQueryClient } from '@ratingo/web-core/query';
import { configureStorefrontApi } from '@/shared/api';
import { I18nProvider, type Dictionary, type Locale } from '@/shared/i18n';

configureStorefrontApi();

interface AppProvidersProps {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}

export function AppProviders({ locale, dictionary, children }: AppProvidersProps) {
  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <QueryClientProvider client={getQueryClient()}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
