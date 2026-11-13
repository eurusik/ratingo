import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const GOOGLE_TAG_URL = 'https://www.googletagmanager.com/gtag/js';

interface SiteAnalyticsProps {
  googleMeasurementId: string | null;
}

function googleTagBootstrap(measurementId: string): string {
  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    `gtag('config', ${JSON.stringify(measurementId)});`,
  ].join('\n');
}

function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`${GOOGLE_TAG_URL}?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {googleTagBootstrap(measurementId)}
      </Script>
    </>
  );
}

export function SiteAnalytics({ googleMeasurementId }: SiteAnalyticsProps) {
  return (
    <>
      <Analytics />
      <SpeedInsights />
      {googleMeasurementId ? <GoogleAnalytics measurementId={googleMeasurementId} /> : null}
    </>
  );
}
