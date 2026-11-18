import Script from 'next/script';

const GOOGLE_TAG_URL = 'https://www.googletagmanager.com/gtag/js';

const CLARITY_TAG_URL = 'https://www.clarity.ms/tag/';

interface SiteAnalyticsProps {
  googleMeasurementId: string | null;
  clarityProjectId: string | null;
}

export function clarityQueueStub(): string {
  return 'window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments)};';
}

export function googleTagBootstrap(measurementId: string): string {
  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    'var pageUrl = new URL(window.location.href);',
    "['code', 'state', 'token'].forEach(function (key) { pageUrl.searchParams.delete(key); });",
    `gtag('config', ${JSON.stringify(measurementId)}, { page_location: pageUrl.href });`,
  ].join('\n');
}

export function SiteAnalytics({ googleMeasurementId, clarityProjectId }: SiteAnalyticsProps) {
  return (
    <>
      {googleMeasurementId ? (
        <Script
          src={`${GOOGLE_TAG_URL}?id=${encodeURIComponent(googleMeasurementId)}`}
          strategy="afterInteractive"
        />
      ) : null}
      {clarityProjectId ? (
        <Script
          src={`${CLARITY_TAG_URL}${encodeURIComponent(clarityProjectId)}`}
          strategy="lazyOnload"
        />
      ) : null}
    </>
  );
}
