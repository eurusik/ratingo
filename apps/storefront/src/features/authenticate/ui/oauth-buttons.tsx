'use client';

import { buttonVariants } from '@heroui/react';
import { buildOAuthStartUrl, rememberPendingIntent, useAuthRequest } from '@/shared/auth';
import { API_BASE_URL } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useBrowserOrigin, useBrowserPath } from '@/shared/lib';
import { ProviderMark } from '@/shared/ui';
import { useEnabledOAuthProviders } from '../model/auth-config';

export function OAuthButtons() {
  const { dict } = useTranslation();
  const providers = useEnabledOAuthProviders();
  const origin = useBrowserOrigin();
  const returnTo = useBrowserPath();
  const intent = useAuthRequest()?.intent;

  if (!origin || !returnTo || providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((provider) => {
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
            onClick={intent ? () => rememberPendingIntent(intent) : undefined}
          >
            <ProviderMark provider={provider} />
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
