'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { I18nProvider as AriaI18nProvider, RouterProvider } from '@heroui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ViewTransitionTraversalGuard } from '@ratingo/ui/motion';
import { ThemeProvider } from '@ratingo/ui/theme';
import { AuthProvider } from '@ratingo/web-core/auth';
import { getQueryClient } from '@ratingo/web-core/query';
import { configureStorefrontApi } from '@/shared/api';
import {
  NAVIGATION_DEBUG_ENABLED,
  SERVICE_WORKER_ENABLED,
  isMediaDetailsPath,
} from '@/shared/config';
import {
  BrowserBackScrollRestorer,
  RouteCommitSignal,
  ServiceWorkerProvider,
  navigateForward,
} from '@/shared/lib';
import { I18nProvider, type Dictionary, type Locale } from '@/shared/i18n';
import { DeferredToastRegion } from './deferred-toast-region';

configureStorefrontApi();

const NavigationDebugPanel = NAVIGATION_DEBUG_ENABLED
  ? dynamic(
      () =>
        import('../navigation-debug/navigation-debug-panel').then(
          (module) => module.NavigationDebugPanel,
        ),
      { ssr: false },
    )
  : null;

interface AppProvidersProps {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}

export function AppProviders({ locale, dictionary, children }: AppProvidersProps) {
  const router = useRouter();

  return (
    <ServiceWorkerProvider enabled={SERVICE_WORKER_ENABLED}>
      <ThemeProvider>
        <ViewTransitionTraversalGuard />
        {NavigationDebugPanel ? <NavigationDebugPanel /> : null}
        <RouteCommitSignal />
        <BrowserBackScrollRestorer />
        <AriaI18nProvider locale={locale}>
          <RouterProvider
            navigate={(href) => {
              if (isMediaDetailsPath(href)) void navigateForward(() => router.push(href));
              else router.push(href);
            }}
          >
            <I18nProvider locale={locale} dictionary={dictionary}>
              <QueryClientProvider client={getQueryClient()}>
                <AuthProvider>{children}</AuthProvider>
              </QueryClientProvider>
            </I18nProvider>
            <DeferredToastRegion placement="bottom" />
          </RouterProvider>
        </AriaI18nProvider>
      </ThemeProvider>
    </ServiceWorkerProvider>
  );
}
