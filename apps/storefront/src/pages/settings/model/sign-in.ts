'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { authApi, tokenStorage, useAuth } from '@ratingo/web-core/auth';
import { accountApi } from '@/shared/api';
import { buildOAuthLinkUrl, type OAuthProvider } from '@/shared/auth';
import { API_BASE_URL, SECURITY_SETTINGS_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { linkResultOf, type LinkOutcome } from './link-result';

const LINKED_ACCOUNTS_KEY = ['auth', 'providers'] as const;

function linkedAccountsKey(userId: string | null) {
  return [...LINKED_ACCOUNTS_KEY, userId] as const;
}

export function useLinkedAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: linkedAccountsKey(user?.id ?? null),
    queryFn: () => accountApi.linkedAccounts(),
    enabled: user !== null,
  });
}

export function useLinkProvider() {
  const { dict } = useTranslation();
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      await refreshUser();
      const accessToken = tokenStorage.getAccessToken();
      if (!accessToken) throw new Error('No access token to start linking a provider');
      window.location.assign(
        buildOAuthLinkUrl({
          apiBaseUrl: API_BASE_URL,
          provider,
          returnTo: SECURITY_SETTINGS_ROUTE,
          returnOrigin: window.location.origin,
          accessToken,
        }),
      );
    },
    onError: (error, provider) => {
      console.error('Starting a provider link failed', { provider, error });
      const copy = dict.settings.security;
      toast.danger(interpolate(copy.linkFailed, { provider: copy.methodNames[provider] }));
    },
  });
}

function useRefreshSignInMethods() {
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();

  return async () => {
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: LINKED_ACCOUNTS_KEY });
  };
}

export function useUnlinkProvider() {
  const refreshMethods = useRefreshSignInMethods();

  return useMutation({
    mutationFn: (provider: OAuthProvider) => authApi.unlinkProvider(provider),
    onSuccess: refreshMethods,
  });
}

export function useLinkResultNotice(): void {
  const { dict } = useTranslation();
  const router = useRouter();
  const refreshMethods = useRefreshSignInMethods();
  const isHandled = useRef(false);

  useEffect(() => {
    if (isHandled.current) return;
    isHandled.current = true;
    const result = linkResultOf(window.location.search);
    if (!result) return;
    const copy = dict.settings.security;
    const messages: Record<LinkOutcome, string> = {
      linked: copy.linked,
      alreadyLinked: copy.alreadyLinked,
      failed: copy.linkFailed,
    };
    const message = interpolate(messages[result.outcome], {
      provider: copy.methodNames[result.provider],
    });
    if (result.outcome === 'linked') {
      toast(message);
      void refreshMethods();
    } else {
      toast.danger(message);
    }
    router.replace(SECURITY_SETTINGS_ROUTE, { scroll: false });
  }, [dict, refreshMethods, router]);
}
