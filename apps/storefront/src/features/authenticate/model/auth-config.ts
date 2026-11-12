'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@ratingo/web-core/auth';
import { OAUTH_PROVIDERS, type OAuthProvider } from '@/shared/auth';

const AUTH_CONFIG_KEY = ['auth', 'config'] as const;

export function useEnabledOAuthProviders(): OAuthProvider[] {
  const { data } = useQuery({
    queryKey: AUTH_CONFIG_KEY,
    queryFn: () => authApi.getAuthConfig(),
    staleTime: Infinity,
  });

  if (!data) return [];
  return OAUTH_PROVIDERS.filter((provider) => data[provider].enabled);
}
