'use client';

import type { MeDto } from '@ratingo/web-core/auth';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { useMediaQuery } from '@/shared/lib';
import { ProfileDropdown } from './profile-dropdown';
import { ProfileSheet } from './profile-sheet';

export function ProfileMenu({ user }: { user: MeDto }) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  return isDesktop ? <ProfileDropdown user={user} /> : <ProfileSheet user={user} />;
}
