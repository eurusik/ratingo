'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@ratingo/web-core/api';
import { authApi, tokenStorage } from '@ratingo/web-core/auth';
import { toSafeReturnPath } from '@/shared/auth';
import { replaceDocumentLocation } from '@/shared/lib';
import { MISSING_CODE_ERROR } from './oauth-error';

const UNKNOWN_EXCHANGE_ERROR = 'UNKNOWN';

interface ExchangeFailure {
  code: string;
  errorCode: string;
}

interface OAuthCallbackParams {
  get(name: string): string | null;
}

export function useOAuthCodeExchange(params: OAuthCallbackParams): string | null {
  const code = params.get('code');
  const providerError = params.get('error');
  const returnTo = toSafeReturnPath(params.get('returnTo'));
  const [exchangeFailure, setExchangeFailure] = useState<ExchangeFailure | null>(null);
  const exchangedCode = useRef<string | null>(null);

  useEffect(() => {
    if (!code || providerError || exchangedCode.current === code) return;
    exchangedCode.current = code;

    authApi
      .exchangeOAuthCode(code)
      .then((tokens) => {
        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
        replaceDocumentLocation(returnTo);
      })
      .catch((error: unknown) => {
        setExchangeFailure({
          code,
          errorCode: error instanceof ApiError ? error.code : UNKNOWN_EXCHANGE_ERROR,
        });
      });
  }, [code, providerError, returnTo]);

  if (providerError) return providerError;
  if (!code) return MISSING_CODE_ERROR;
  return exchangeFailure?.code === code ? exchangeFailure.errorCode : null;
}
