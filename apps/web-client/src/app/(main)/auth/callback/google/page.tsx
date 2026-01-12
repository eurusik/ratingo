/**
 * Google OAuth callback page.
 *
 * Handles the OAuth redirect from Google, exchanges the one-time code
 * for tokens, and redirects the user to their destination.
 */

'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { tokenStorage } from '@/core/auth';
import { authApi } from '@/core/api';
import { Button } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

/** Error code to i18n key mapping. */
const errorCodeToKey: Record<string, string> = {
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
function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  /**
   * Maps error code to localized message.
   */
  const getErrorMessage = useCallback(
    (code: string): string => {
      const key = errorCodeToKey[code] || 'unknown';
      return (
        dict.auth.oauth.errors[key as keyof typeof dict.auth.oauth.errors] ||
        dict.auth.oauth.errors.unknown
      );
    },
    [dict],
  );

  const handleOAuthCallback = useCallback(async () => {
    const code = searchParams.get('code');
    const errorCode = searchParams.get('error');
    const returnTo = validateReturnTo(searchParams.get('returnTo'));

    // Handle error from OAuth provider
    if (errorCode) {
      setError(getErrorMessage(errorCode));
      setIsProcessing(false);
      return;
    }

    // Missing code
    if (!code) {
      setError(getErrorMessage('OAUTH_EXCHANGE_EXPIRED'));
      setIsProcessing(false);
      return;
    }

    try {
      // Exchange code for tokens
      const tokens = await authApi.exchangeOAuthCode(code);

      // Store tokens
      tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);

      // Redirect to destination — AuthProvider will fetch user on mount
      window.location.href = returnTo;
    } catch (err) {
      // Extract error code from ApiError
      const errorCode =
        err && typeof err === 'object' && 'code' in err ? String(err.code) : 'UNKNOWN';
      setError(getErrorMessage(errorCode));
      setIsProcessing(false);
    }
  }, [searchParams, getErrorMessage]);

  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

  const handleRetry = () => {
    router.push('/');
  };

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">{dict.auth.oauth.failed}</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <Button onClick={handleRetry} variant="outline">
          {dict.auth.oauth.tryAgain}
        </Button>
      </div>
    );
  }

  // Loading state
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">{dict.auth.oauth.completing}</p>
      </div>
    );
  }

  return null;
}

/**
 * Google OAuth callback page.
 *
 * Processes the OAuth redirect, exchanges the one-time code for tokens,
 * and redirects the user to their destination.
 */
export default function GoogleCallbackPage() {
  const { dict } = useTranslation();

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{dict.auth.oauth.loading}</p>
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
