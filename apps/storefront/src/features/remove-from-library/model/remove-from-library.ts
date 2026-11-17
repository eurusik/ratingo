'use client';

import { useCallback } from 'react';
import { toast } from '@heroui/react';
import { useRefreshWatchProgress } from '@/entities/episode';
import { useLibraryListsStore, useMediaStateStore } from '@/entities/library';
import { libraryApi } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { showUndoToast, track } from '@/shared/lib';

export interface RemovableMedia {
  mediaItemId: string;
  title: string;
}

interface RemovalHandlers {
  onUndo?: () => void;
  onSettled?: () => void;
}

type RemoveFromLibrary = (media: RemovableMedia, handlers?: RemovalHandlers) => void;

export function useRemoveFromLibrary(): RemoveFromLibrary {
  const { dict } = useTranslation();
  const mediaStates = useMediaStateStore();
  const lists = useLibraryListsStore();
  const refreshWatchProgress = useRefreshWatchProgress();
  const { removed, undo, failed } = dict.library.toast;

  return useCallback(
    ({ mediaItemId, title }, handlers = {}) => {
      const before = mediaStates.read(mediaItemId);
      const restore = () => {
        if (before) mediaStates.write(mediaItemId, before);
        else mediaStates.refresh(mediaItemId);
        handlers.onUndo?.();
      };

      const removeForGood = async () => {
        try {
          await libraryApi.removeFromLibrary(mediaItemId);
          track('library_action', { action: 'remove_from_library' });
        } catch (error) {
          console.error('Removing from the library failed', { mediaItemId, error });
          restore();
          toast.danger(failed);
        }
        mediaStates.refresh(mediaItemId);
        await Promise.all([lists.refresh(), refreshWatchProgress()]).catch((error: unknown) => {
          console.error('Refreshing the library failed', { mediaItemId, error });
        });
        handlers.onSettled?.();
      };

      mediaStates.write(mediaItemId, null);
      showUndoToast({
        key: `library-remove:${mediaItemId}`,
        message: interpolate(removed, { title }),
        undoLabel: undo,
        onUndo: restore,
        onKept: () => void removeForGood(),
      });
    },
    [mediaStates, lists, refreshWatchProgress, removed, undo, failed],
  );
}
