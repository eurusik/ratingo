'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@ratingo/web-core/api';
import { authApi, tokenStorage } from '@ratingo/web-core/auth';
import { toSafeReturnPath, type OAuthProvider } from '@/shared/auth';
import { replaceDocumentLocation, track } from '@/shared/lib';
import { MISSING_CODE_ERROR } from './oauth-error';

const UNKNOWN_EXCHANGE_ERROR = 'UNKNOWN';

interface ExchangeFailure {
  code: string;
  errorCode: string;
}

interface OAuthCallbackParams {
  get(name: string): string | null;
}

function resolveErrorCode(
  code: string | null,
  providerError: string | null,
  exchangeFailure: ExchangeFailure | null,
): string | null {
  if (providerError) return providerError;
  if (!code) return MISSING_CODE_ERROR;
  return exchangeFailure?.code === code ? exchangeFailure.errorCode : null;
}

export function useOAuthCodeExchange(
  params: OAuthCallbackParams,
  provider: OAuthProvider,
): string | null {
  const code = params.get('code');
  const providerError = params.get('error');
  const returnTo = toSafeReturnPath(params.get('returnTo'));
  const isNewUser = params.get('new') === '1';
  const [exchangeFailure, setExchangeFailure] = useState<ExchangeFailure | null>(null);
  const exchangedCode = useRef<string | null>(null);
  const reportedFailure = useRef<string | null>(null);

  useEffect(() => {
    if (!code || providerError || exchangedCode.current === code) return;
    exchangedCode.current = code;

    authApi
      .exchangeOAuthCode(code)
      .then((tokens) => {
        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
        track(isNewUser ? 'sign_up' : 'login', { method: provider });
        replaceDocumentLocation(returnTo);
      })
      .catch((error: unknown) => {
        setExchangeFailure({
          code,
          errorCode: error instanceof ApiError ? error.code : UNKNOWN_EXCHANGE_ERROR,
        });
      });
  }, [code, isNewUser, provider, providerError, returnTo]);

  const errorCode = resolveErrorCode(code, providerError, exchangeFailure);

  useEffect(() => {
    if (!errorCode || reportedFailure.current === errorCode) return;
    reportedFailure.current = errorCode;
    track('login_failed', { method: provider, reason: errorCode });
  }, [errorCode, provider]);

  return errorCode;
}
