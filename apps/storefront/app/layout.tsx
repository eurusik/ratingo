import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppProviders, getRequestLocale } from '@/app/entrypoint';
import { configureStorefrontApi } from '@/shared/api';
import { GA_MEASUREMENT_ID, IS_PRODUCTION_SITE, SITE_URL } from '@/shared/config';
import { getDictionary } from '@/shared/i18n';
import {
  APP_THEME_COLOR,
  JsonLd,
  SiteAnalytics,
  buildOrganizationJsonLd,
  buildRootMetadata,
  buildWebSiteJsonLd,
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
        <JsonLd data={buildOrganizationJsonLd(SITE_URL)} />
        <JsonLd data={buildWebSiteJsonLd(SITE_URL)} />
        <AppProviders locale={locale} dictionary={getDictionary(locale)}>
          {children}
        </AppProviders>
        <SiteAnalytics googleMeasurementId={GA_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
