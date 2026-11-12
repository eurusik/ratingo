'use client';

import type { ComponentType } from 'react';
import { Skeleton, buttonVariants } from '@heroui/react';
import { OAUTH_PROVIDERS, buildOAuthStartUrl, type OAuthProvider } from '@/shared/auth';
import { API_BASE_URL } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useBrowserOrigin, useBrowserPath } from '@/shared/lib';
import { useEnabledOAuthProviders } from '../model/auth-config';

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
      />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.1 15.5l.5-3.5h-3.3V9.8c0-1 .5-1.9 2-1.9h1.5v-3s-1.4-.2-2.7-.2c-2.8 0-4.6 1.7-4.6 4.7V12H5.4v3.5h3.1V24h3.8v-8.5z"
      />
    </svg>
  );
}

const PROVIDER_MARKS: Record<OAuthProvider, ComponentType> = {
  google: GoogleMark,
  facebook: FacebookMark,
};

export function OAuthButtons() {
  const { dict } = useTranslation();
  const { providers, isPending } = useEnabledOAuthProviders();
  const origin = useBrowserOrigin();
  const returnTo = useBrowserPath();

  if (isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-2.5">
        {OAUTH_PROVIDERS.map((provider) => (
          <Skeleton key={provider} className="h-12 w-full rounded-full" />
        ))}
        <Skeleton className="mx-auto my-2 h-5 w-32 rounded-full" />
      </div>
    );
  }
  if (!origin || !returnTo || providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((provider) => {
        const Mark = PROVIDER_MARKS[provider];
        return (
          <a
            key={provider}
            href={buildOAuthStartUrl({
              apiBaseUrl: API_BASE_URL,
              provider,
              returnTo,
              returnOrigin: origin,
            })}
            className={buttonVariants({ variant: 'tertiary', size: 'lg', fullWidth: true })}
          >
            <Mark />
            {dict.auth.continueWith[provider]}
          </a>
        );
      })}
      <p className="my-2 flex items-center gap-3 text-sm text-muted before:h-px before:flex-1 before:bg-separator after:h-px after:flex-1 after:bg-separator">
        {dict.auth.orEmail}
      </p>
    </div>
  );
}
