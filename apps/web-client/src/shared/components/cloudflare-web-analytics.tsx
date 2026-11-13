import Script from 'next/script';

const CF_BEACON_TOKEN =
  process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? '1b33e062ae66431397be694e712a258a';

export function CloudflareWebAnalytics() {
  if (process.env.APP_ENV !== 'production') return null;

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
    />
  );
}
