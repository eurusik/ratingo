'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/shared/i18n';
import { toOAuthErrorKey } from '../model/oauth-error';
import { useOAuthCodeExchange } from '../model/use-oauth-code-exchange';

function CallbackProgress() {
  const { dict } = useTranslation();

  return (
    <main className="page page--centered" aria-busy="true">
      <div role="status">
        <h1>{dict.oauth.completing}</h1>
      </div>
    </main>
  );
}

function CallbackError({ code }: { code: string }) {
  const { dict } = useTranslation();

  return (
    <main className="page page--centered">
      <h1>{dict.oauth.failed}</h1>
      <p className="muted" role="alert">
        {dict.oauth.errors[toOAuthErrorKey(code)]}
      </p>
      <div className="actions actions--centered">
        <Link className="action" href="/">
          {dict.oauth.backHome}
        </Link>
      </div>
    </main>
  );
}

const NO_SEARCH_PARAMS = new URLSearchParams();

function OAuthCallbackContent() {
  const errorCode = useOAuthCodeExchange(useSearchParams() ?? NO_SEARCH_PARAMS);

  return errorCode ? <CallbackError code={errorCode} /> : <CallbackProgress />;
}

export function OAuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackProgress />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
