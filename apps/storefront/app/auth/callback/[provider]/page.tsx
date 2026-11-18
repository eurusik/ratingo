import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRequestLocale } from '@/app/entrypoint';
import { OAuthCallbackPage } from '@/pages/auth-callback';
import { OAUTH_PROVIDERS } from '@/shared/auth';
import { TranslationScope } from '@/shared/i18n';

export const dynamicParams = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return OAUTH_PROVIDERS.map((provider) => ({ provider }));
}

interface OAuthCallbackRouteProps {
  params: Promise<{ provider: string }>;
}

export default async function OAuthCallbackRoute({ params }: OAuthCallbackRouteProps) {
  const { provider } = await params;
  const oauthProvider = OAUTH_PROVIDERS.find((candidate) => candidate === provider);
  if (!oauthProvider) notFound();

  return (
    <TranslationScope locale={await getRequestLocale()} namespaces={['oauth']}>
      <OAuthCallbackPage provider={oauthProvider} />
    </TranslationScope>
  );
}
