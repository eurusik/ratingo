'use client';

import { useCallback } from 'react';
import { toast } from '@heroui/react';
import { useRefreshWatchProgress } from '@/entities/episode';
import { useLibraryListsStore, useMediaStateStore } from '@/entities/library';
import { libraryApi } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { showUndoToast, track } from '@/shared/lib';

interface RemovableMedia {
  mediaItemId: string;
  title: string;
}

interface RemovalHandlers {
  onUndo?: () => void;
  onSettled?: () => void;
}

type RemoveFromLibrary = (media: RemovableMedia, handlers?: RemovalHandlers) => void;

function onPageHide(flush: () => void): () => void {
  window.addEventListener('pagehide', flush);
  return () => window.removeEventListener('pagehide', flush);
}

export function useRemoveFromLibrary(): RemoveFromLibrary {
  const { dict } = useTranslation();
  const mediaStates = useMediaStateStore();
  const lists = useLibraryListsStore();
  const refreshWatchProgress = useRefreshWatchProgress();
  const { removed, undo, failed } = dict.library.toast;

  return useCallback(
    ({ mediaItemId, title }, handlers = {}) => {
      const before = mediaStates.read(mediaItemId);
      const isSuperseded = () => mediaStates.read(mediaItemId) !== null;
      let isDone = false;

      const putBack = () => {
        if (before && !isSuperseded()) mediaStates.write(mediaItemId, before);
        else mediaStates.refresh(mediaItemId);
        handlers.onUndo?.();
      };

      const reconcile = async () => {
        mediaStates.refresh(mediaItemId);
        await Promise.all([lists.refresh(), refreshWatchProgress()]).catch((error: unknown) => {
          console.error('Refreshing the library failed', { mediaItemId, error });
        });
        handlers.onSettled?.();
      };

      const commit = async () => {
        try {
          await libraryApi.removeFromLibrary(mediaItemId);
          track('library_action', { action: 'remove_from_library' });
        } catch (error) {
          console.error('Removing from the library failed', { mediaItemId, error });
          putBack();
          toast.danger(failed);
        }
      };

      const finish = async (outcome: 'undo' | 'keep') => {
        if (isDone) return;
        isDone = true;
        stopListening();
        if (outcome === 'undo' || isSuperseded()) {
          putBack();
          if (outcome === 'keep') await reconcile();
          return;
        }
        await commit();
        await reconcile();
      };

      const stopListening = onPageHide(() => void finish('keep'));
      mediaStates.write(mediaItemId, null);
      showUndoToast({
        key: `library-remove:${mediaItemId}`,
        message: interpolate(removed, { title }),
        undoLabel: undo,
        onUndo: () => void finish('undo'),
        onKept: () => void finish('keep'),
      });
    },
    [mediaStates, lists, refreshWatchProgress, removed, undo, failed],
  );
}
