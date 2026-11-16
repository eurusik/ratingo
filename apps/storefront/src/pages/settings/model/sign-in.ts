'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { ApiError } from '@ratingo/web-core/api';
import { authApi, tokenStorage, useAuth } from '@ratingo/web-core/auth';
import { accountApi } from '@/shared/api';
import { buildOAuthLinkUrl, type OAuthProvider } from '@/shared/auth';
import { API_BASE_URL, SECURITY_SETTINGS_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { linkResultOf, type LinkOutcome } from './link-result';

const FORBIDDEN_STATUS = 403;

function linkedAccountsKey(userId: string | null) {
  return ['auth', 'providers', userId] as const;
}

export function useLinkedAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: linkedAccountsKey(user?.id ?? null),
    queryFn: () => accountApi.linkedAccounts(),
    enabled: user !== null,
  });
}

export function useLinkProvider(): (provider: OAuthProvider) => Promise<void> {
  const { refreshUser } = useAuth();

  return async (provider) => {
    await refreshUser();
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) return;
    window.location.assign(
      buildOAuthLinkUrl({
        apiBaseUrl: API_BASE_URL,
        provider,
        returnTo: SECURITY_SETTINGS_ROUTE,
        returnOrigin: window.location.origin,
        accessToken,
      }),
    );
  };
}

function useRefreshSignInMethods() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  return async () => {
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: linkedAccountsKey(user?.id ?? null) });
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

export function isWrongPassword(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === FORBIDDEN_STATUS;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (change: Parameters<typeof accountApi.changePassword>[0]) =>
      accountApi.changePassword(change),
  });
}
