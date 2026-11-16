'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth, type MeDto } from '@ratingo/web-core/auth';
import { accountApi, type ProfileChanges } from '@/shared/api';
import { PUBLIC_PROFILE_ROUTE, SITE_URL, publicProfileRoute } from '@/shared/config';

const PROFILE_HOST = new URL(SITE_URL).host;

const PROFILE_UPDATE_SCOPE = { id: 'settings-profile-update' };

export const PROFILE_ADDRESS_PREFIX = `${PROFILE_HOST}${PUBLIC_PROFILE_ROUTE}/`;

export type ProfileVisibility = 'public' | 'private';

export function profileAddress(username: string): string {
  return `${PROFILE_HOST}${publicProfileRoute(username)}`;
}

export function visibilityOf(user: MeDto): ProfileVisibility {
  return user.profile.privacy.isProfilePublic ? 'public' : 'private';
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
    scope: PROFILE_UPDATE_SCOPE,
    onSuccess: () => refreshUser(),
  });
}
