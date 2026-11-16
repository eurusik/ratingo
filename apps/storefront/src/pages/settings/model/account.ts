'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth, type MeDto } from '@ratingo/web-core/auth';
import { accountApi, type ProfileChanges } from '@/shared/api';
import { SITE_URL } from '@/shared/config';

const PROFILE_HOST = new URL(SITE_URL).host;

export const PROFILE_ADDRESS_PREFIX = `${PROFILE_HOST}/u/`;

export function profileAddress(username: string): string {
  return `${PROFILE_ADDRESS_PREFIX}${username}`;
}

export function useAccount(): MeDto {
  const { user } = useAuth();
  if (!user) throw new Error('Settings sections render only for a signed-in user');
  return user;
}

export function useUpdateProfile() {
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: (changes: ProfileChanges) => accountApi.updateProfile(changes),
    onSuccess: () => refreshUser(),
  });
}
