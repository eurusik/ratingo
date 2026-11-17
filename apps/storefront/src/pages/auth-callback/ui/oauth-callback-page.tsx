'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buttonVariants } from '@heroui/react';
import { buildOAuthStartUrl, openAuth, toSafeReturnPath, type OAuthProvider } from '@/shared/auth';
import { API_BASE_URL } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useBrowserOrigin } from '@/shared/lib';
import {
  BrandIcon,
  ERROR_STATE_ACTION,
  ERROR_STATE_TEXT,
  ERROR_STATE_TITLE,
  ErrorStateLink,
  ProviderMark,
} from '@/shared/ui';
import { toOAuthErrorKey, type OAuthErrorKey } from '../model/oauth-error';
import { useOAuthCodeExchange } from '../model/use-oauth-code-exchange';

const MARK_SIZE = 96;
const RING_DELAYS = ['0s', '0.8s', '1.6s'];

const PRIMARY_ACTION = buttonVariants({
  variant: 'primary',
  size: 'lg',
  className: ERROR_STATE_ACTION,
});

const PROVIDER_NAMES: Record<OAuthProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
};

function ProviderChip({ provider }: { provider: OAuthProvider }) {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border bg-surface ps-1.5 pe-3 text-[13px] font-semibold text-foreground/85 [&_svg]:size-3.5">
      <ProviderMark provider={provider} />
      {PROVIDER_NAMES[provider]}
    </span>
  );
}

function CallbackLayout({ busy = false, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <main
      aria-busy={busy}
      className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-6 pt-[max(2rem,var(--safe-top))] pb-[max(2rem,var(--safe-bottom))] text-center md:gap-10"
    >
      {children}
    </main>
  );
}

function CallbackProgress({ provider }: { provider: OAuthProvider }) {
  const { dict } = useTranslation();

  return (
    <CallbackLayout busy>
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[30rem] -translate-x-1/2 -translate-y-[58%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_12%,transparent),transparent)] md:size-[45rem]"
      />
      <div aria-hidden className="relative" style={{ width: MARK_SIZE, height: MARK_SIZE }}>
        {RING_DELAYS.map((delay) => (
          <span
            key={delay}
            className="absolute inset-0 rounded-[31%] border-2 border-accent opacity-0 motion-safe:animate-oauth-ring"
            style={{ animationDelay: delay }}
          />
        ))}
        <span className="relative block rounded-[31%] shadow-[0_1rem_2.5rem_rgb(0_0_0/0.5)]">
          <BrandIcon size={MARK_SIZE} playing />
        </span>
      </div>
      <div
        role="status"
        className="flex max-w-md flex-col items-center gap-2.5 motion-safe:animate-oauth-rise"
      >
        <ProviderChip provider={provider} />
        <h1 className="text-2xl font-extrabold tracking-tight md:text-[28px]">
          {dict.oauth.completing}
        </h1>
        <p className={ERROR_STATE_TEXT}>{dict.oauth.completingHint}</p>
      </div>
      <div
        aria-hidden
        className="relative h-[3px] w-36 overflow-hidden rounded-full bg-border motion-reduce:hidden"
      >
        <span className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent motion-safe:animate-oauth-bar" />
      </div>
    </CallbackLayout>
  );
}

function WarningBadge() {
  return (
    <span className="absolute -end-2 -bottom-2 flex size-10 items-center justify-center rounded-full border-4 border-background bg-warning text-background">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        className="size-4"
      >
        <path d="M12 6v7M12 17.5v.01" />
      </svg>
    </span>
  );
}

interface CallbackActionsProps {
  errorKey: OAuthErrorKey;
  provider: OAuthProvider;
  returnTo: string;
}

interface CallbackErrorProps {
  code: string;
  provider: OAuthProvider;
  returnTo: string;
}

function CallbackActions({ errorKey, provider, returnTo }: CallbackActionsProps) {
  const { dict } = useTranslation();
  const origin = useBrowserOrigin();
  const backLabel = returnTo === '/' ? dict.oauth.backHome : dict.oauth.back;

  let primary: ReactNode = null;
  if (errorKey === 'accountExistsPassword') {
    primary = (
      <Link href={returnTo} onClick={() => openAuth({ mode: 'login' })} className={PRIMARY_ACTION}>
        {dict.oauth.signInWithPassword}
      </Link>
    );
  } else if (origin) {
    primary = (
      <a
        href={buildOAuthStartUrl({
          apiBaseUrl: API_BASE_URL,
          provider,
          returnTo,
          returnOrigin: origin,
        })}
        className={PRIMARY_ACTION}
      >
        {dict.oauth.retry}
      </a>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:gap-2.5">
      {primary}
      <ErrorStateLink href={returnTo}>{backLabel}</ErrorStateLink>
    </div>
  );
}

function CallbackError({ code, provider, returnTo }: CallbackErrorProps) {
  const { dict } = useTranslation();
  const errorKey = toOAuthErrorKey(code);
  const cancelled = errorKey === 'cancelled';

  return (
    <CallbackLayout>
      <div
        aria-hidden
        className={cancelled ? 'relative' : 'relative motion-safe:animate-oauth-nudge'}
        style={{ width: MARK_SIZE, height: MARK_SIZE }}
      >
        <span className="block opacity-55 grayscale">
          <BrandIcon size={MARK_SIZE} />
        </span>
        {cancelled ? null : <WarningBadge />}
      </div>
      <div className="flex w-full max-w-md flex-col items-center gap-6 motion-safe:animate-oauth-rise">
        <div className="flex flex-col items-center gap-2.5">
          <ProviderChip provider={provider} />
          <h1 className={ERROR_STATE_TITLE}>
            {cancelled ? dict.oauth.cancelledTitle : dict.oauth.failed}
          </h1>
          <p role={cancelled ? 'status' : 'alert'} className={ERROR_STATE_TEXT}>
            {dict.oauth.errors[errorKey]}
          </p>
        </div>
        <CallbackActions errorKey={errorKey} provider={provider} returnTo={returnTo} />
      </div>
    </CallbackLayout>
  );
}

const NO_SEARCH_PARAMS = new URLSearchParams();

function OAuthCallbackContent({ provider }: { provider: OAuthProvider }) {
  const searchParams = useSearchParams() ?? NO_SEARCH_PARAMS;
  const errorCode = useOAuthCodeExchange(searchParams);

  return errorCode ? (
    <CallbackError
      code={errorCode}
      provider={provider}
      returnTo={toSafeReturnPath(searchParams.get('returnTo'))}
    />
  ) : (
    <CallbackProgress provider={provider} />
  );
}

export function OAuthCallbackPage({ provider }: { provider: OAuthProvider }) {
  return (
    <Suspense fallback={<CallbackProgress provider={provider} />}>
      <OAuthCallbackContent provider={provider} />
    </Suspense>
  );
}
