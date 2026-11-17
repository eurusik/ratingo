import Script from 'next/script';

const GOOGLE_TAG_URL = 'https://www.googletagmanager.com/gtag/js';

const CLARITY_TAG_URL = 'https://www.clarity.ms/tag/';

interface SiteAnalyticsProps {
  googleMeasurementId: string | null;
}

export function clarityBootstrap(projectId: string): string {
  return [
    '(function(c,l,a,r,i,t,y){',
    'c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};',
    't=l.createElement(r);t.async=1;t.src=i;',
    'y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);',
    `})(window,document,"clarity","script",${JSON.stringify(`${CLARITY_TAG_URL}${projectId}`)});`,
  ].join('\n');
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

function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <Script
      src={`${GOOGLE_TAG_URL}?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
    />
  );
}

export function SiteAnalytics({ googleMeasurementId }: SiteAnalyticsProps) {
  return googleMeasurementId ? <GoogleAnalytics measurementId={googleMeasurementId} /> : null;
}
