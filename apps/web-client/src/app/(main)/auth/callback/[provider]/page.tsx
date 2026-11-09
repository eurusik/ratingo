/**
 * Dynamic OAuth callback page.
 *
 * Handles the OAuth redirect from any supported provider (Google, Facebook, etc.),
 * exchanges the one-time code for tokens, and redirects the user to their destination.
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams, notFound } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { tokenStorage } from '@/core/auth';
import { authApi } from '@/core/api';
import { Button } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

/** Supported OAuth providers. */
const SUPPORTED_PROVIDERS = ['google', 'facebook'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/** Error code to i18n key mapping. */
const errorCodeToKey: Record<string, string> = {
  OAUTH_ACCOUNT_EXISTS_PASSWORD: 'accountExistsPassword',
  OAUTH_CANCELLED: 'cancelled',
  OAUTH_EMAIL_NOT_VERIFIED: 'emailNotVerified',
  OAUTH_EXCHANGE_EXPIRED: 'exchangeExpired',
  OAUTH_EXCHANGE_USED: 'exchangeUsed',
  OAUTH_PROVIDER_ERROR: 'providerError',
  OAUTH_STATE_INVALID: 'stateInvalid',
};

/**
 * Validates that returnTo is a safe relative path.
 * Prevents open redirect vulnerabilities.
 */
function validateReturnTo(returnTo: string | null): string {
  if (!returnTo) return '/';
  // Must start with / and not start with // (protocol-relative URL)
  if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    return returnTo;
  }
  return '/';
}

/**
 * Inner component that uses useSearchParams.
 * Wrapped in Suspense boundary in the main export.
 */
function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict } = useTranslation();
  const [exchangeErrorCode, setExchangeErrorCode] = useState<string | null>(null);

  const code = searchParams.get('code');
  const providerErrorCode = searchParams.get('error');
  const returnTo = validateReturnTo(searchParams.get('returnTo'));
  const requestErrorCode = providerErrorCode ?? (code ? null : 'OAUTH_EXCHANGE_EXPIRED');
  const errorCode = requestErrorCode ?? exchangeErrorCode;

  /**
   * Maps error code to localized message.
   */
  const getErrorMessage = (errorCodeToMap: string): string => {
    const key = errorCodeToKey[errorCodeToMap] || 'unknown';
    return (
      dict.auth.oauth.errors[key as keyof typeof dict.auth.oauth.errors] ||
      dict.auth.oauth.errors.unknown
    );
  };

  useEffect(() => {
    if (!code || providerErrorCode) return;

    authApi
      .exchangeOAuthCode(code)
      .then((tokens) => {
        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
        window.location.href = returnTo;
      })
      .catch((err: unknown) => {
        setExchangeErrorCode(
          err && typeof err === 'object' && 'code' in err ? String(err.code) : 'UNKNOWN',
        );
      });
  }, [code, providerErrorCode, returnTo]);

  const handleRetry = () => {
    router.push('/');
  };

  if (errorCode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">{dict.auth.oauth.failed}</h1>
          <p className="text-muted-foreground">{getErrorMessage(errorCode)}</p>
        </div>
        <Button onClick={handleRetry} variant="outline">
          {dict.auth.oauth.tryAgain}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">{dict.auth.oauth.completing}</p>
    </div>
  );
}

/**
 * Dynamic OAuth callback page.
 *
 * Processes the OAuth redirect for any supported provider, exchanges the
 * one-time code for tokens, and redirects the user to their destination.
 *
 * Supported providers: google, facebook.
 * Returns 404 for unsupported provider slugs.
 */
export default function OAuthCallbackPage() {
  const params = useParams<{ provider: string }>();
  const { dict } = useTranslation();

  if (!isSupportedProvider(params.provider)) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{dict.auth.oauth.loading}</p>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
