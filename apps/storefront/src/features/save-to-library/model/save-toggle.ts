'use client';

import { useAuth } from '@ratingo/web-core/auth';
import { isSaved, useSaveStatus } from '@/entities/library';
import { useSignedInAction } from '@/shared/auth';
import { useLibrarySave, type SavableMedia } from './library-save';

export function useSaveToggle(media: SavableMedia) {
  const { isAuthenticated } = useAuth();
  const runSignedIn = useSignedInAction();
  const { toggleSaved, save } = useLibrarySave();
  const saved = isSaved(useSaveStatus(media.mediaItemId));
  const savable = { mediaItemId: media.mediaItemId, title: media.title };

  const toggle = () => {
    if (isAuthenticated) toggleSaved(savable);
    else runSignedIn(() => save(savable), { kind: 'save', ...savable });
  };

  return { saved, toggle };
}
