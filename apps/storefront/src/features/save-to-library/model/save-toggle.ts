'use client';

import { useAuth } from '@ratingo/web-core/auth';
import { isSaved, useSaveStatus } from '@/entities/library';
import { useSignedInAction } from '@/shared/auth';
import type { HomeBlock } from '@/shared/lib';
import { useLibrarySave, type SavableMedia } from './library-save';

export function useSaveToggle(media: Omit<SavableMedia, 'origin'>, origin?: HomeBlock) {
  const { isAuthenticated } = useAuth();
  const runSignedIn = useSignedInAction();
  const { toggleSaved, save } = useLibrarySave();
  const saved = isSaved(useSaveStatus(media.mediaItemId));
  const savable = { mediaItemId: media.mediaItemId, title: media.title };

  const toggle = () => {
    if (isAuthenticated) toggleSaved({ ...savable, origin });
    else runSignedIn(() => save({ ...savable, origin }), { kind: 'save', ...savable });
  };

  return { saved, toggle };
}
