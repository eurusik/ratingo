import type { Metadata } from 'next';
import { OAuthCallbackPage } from '@/pages/auth-callback';
import { OAUTH_PROVIDERS } from '@/shared/auth';

export const dynamicParams = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return OAUTH_PROVIDERS.map((provider) => ({ provider }));
}

export default function OAuthCallbackRoute() {
  return <OAuthCallbackPage />;
}
