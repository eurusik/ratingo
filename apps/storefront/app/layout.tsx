import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { AppProviders, getRequestLocale } from '@/app/entrypoint';
import { configureStorefrontApi } from '@/shared/api';
import {
  CLARITY_PROJECT_ID,
  GA_MEASUREMENT_ID,
  IMAGE_HOST_ORIGIN,
  IS_PRODUCTION_SITE,
  SITE_URL,
} from '@/shared/config';
import { TranslationScope, getDictionary } from '@/shared/i18n';
import {
  APP_THEME_COLOR,
  JsonLd,
  SiteAnalytics,
  buildOrganizationJsonLd,
  buildRootMetadata,
  buildWebSiteJsonLd,
  clarityQueueStub,
  googleTagBootstrap,
} from '@/shared/lib';
import '@/app/styles/globals.css';

configureStorefrontApi();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return buildRootMetadata({
    locale,
    dict: getDictionary(locale),
    siteUrl: SITE_URL,
    indexingEnabled: IS_PRODUCTION_SITE,
  });
}

export const viewport: Viewport = {
  themeColor: APP_THEME_COLOR,
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
        {IMAGE_HOST_ORIGIN ? <link rel="preconnect" href={IMAGE_HOST_ORIGIN} /> : null}
        {GA_MEASUREMENT_ID ? (
          <Script id="google-analytics" strategy="beforeInteractive">
            {googleTagBootstrap(GA_MEASUREMENT_ID)}
          </Script>
        ) : null}
        {CLARITY_PROJECT_ID ? (
          <Script id="microsoft-clarity" strategy="beforeInteractive">
            {clarityQueueStub()}
          </Script>
        ) : null}
        <JsonLd data={buildOrganizationJsonLd(SITE_URL)} />
        <JsonLd data={buildWebSiteJsonLd(SITE_URL)} />
        <AppProviders locale={locale}>
          <TranslationScope locale={locale} namespaces={['common']}>
            {children}
          </TranslationScope>
        </AppProviders>
        <SiteAnalytics
          googleMeasurementId={GA_MEASUREMENT_ID}
          clarityProjectId={CLARITY_PROJECT_ID}
        />
      </body>
    </html>
  );
}
