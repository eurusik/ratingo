/**
 * React Query hook for unlinking an OAuth provider from the current account.
 */

'use client';

import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/core/api';
import { useAuth } from '@/core/auth';

/**
 * Mutation hook to unlink an OAuth provider from the current account.
 * Refreshes user data on success so linkedProviders stays in sync.
 */
export function useUnlinkAccount() {
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: (provider: string) => authApi.unlinkProvider(provider),
    onSuccess: () => {
      refreshUser();
    },
  });
}
