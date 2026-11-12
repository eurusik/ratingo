'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@ratingo/web-core/auth';
import { OAUTH_PROVIDERS, type OAuthProvider } from '@/shared/auth';

const AUTH_CONFIG_KEY = ['auth', 'config'] as const;

interface EnabledOAuthProviders {
  providers: OAuthProvider[];
  isPending: boolean;
}

export function useEnabledOAuthProviders(): EnabledOAuthProviders {
  const { data, isPending } = useQuery({
    queryKey: AUTH_CONFIG_KEY,
    queryFn: () => authApi.getAuthConfig(),
    staleTime: Infinity,
  });

  const providers = data ? OAUTH_PROVIDERS.filter((provider) => data[provider].enabled) : [];
  return { providers, isPending };
}
