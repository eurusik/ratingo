'use client';

import { useCallback, useMemo } from 'react';
import { toast } from '@heroui/react';
import { useRefreshWatchProgress } from '@/entities/episode';
import {
  useLibraryListsStore,
  useLibraryStore,
  useMediaStateStore,
  type LibraryList,
} from '@/entities/library';
import { useRemoveFromLibrary } from '@/features/remove-from-library';
import { useTranslation } from '@/shared/i18n';
import { showUndoToast, track } from '@/shared/lib';
import { moveSpecs, type MoveSpec, type MoveSpecs } from './library-move-specs';
import { useLibraryMoveActions } from './library-moves';
import type { LibraryTitle } from './library-title';

type Act<K extends keyof MoveSpecs> = (...args: Parameters<MoveSpecs[K]>) => void;

export type LibraryActions = { [K in keyof MoveSpecs]: Act<K> } & {
  refresh: () => Promise<void>;
  removeFromLibrary: (title: LibraryTitle, from: LibraryList) => void;
};

export function useLibraryActions(): LibraryActions {
  const { dict } = useTranslation();
  const lists = useLibraryListsStore();
  const saveStatuses = useLibraryStore();
  const mediaStates = useMediaStateStore();
  const moves = useLibraryMoveActions();
  const refreshWatchProgress = useRefreshWatchProgress();
  const remove = useRemoveFromLibrary();

  const refresh = useCallback(async () => {
    await Promise.all([lists.refresh(), refreshWatchProgress()]);
  }, [lists, refreshWatchProgress]);

  const settle = useCallback(
    async (spec: MoveSpec, change: () => Promise<unknown>, token?: number) => {
      const { mediaItemId } = spec.title;
      let isSaved = true;
      try {
        await change();
      } catch (error) {
        isSaved = false;
        console.error('Updating the library failed', { mediaItemId, error });
        toast.danger(dict.my.toast.failed);
      }
      mediaStates.refresh(mediaItemId);
      saveStatuses.refresh(mediaItemId);
      await refresh().catch((error: unknown) => {
        console.error('Refreshing the library failed', { mediaItemId, error });
      });
      if (token !== undefined) moves.forget(mediaItemId, token);
      return isSaved;
    },
    [dict, mediaStates, moves, refresh, saveStatuses],
  );

  const run = useCallback(
    (action: keyof MoveSpecs, spec: MoveSpec) => {
      const { title, from, to } = spec;
      const isMove = from !== to;
      const token = isMove ? moves.track(title.mediaItemId, to ?? 'gone') : undefined;
      if (isMove) lists.move({ from, to });
      const committed = settle(spec, spec.commit, token);
      void committed.then((isCommitted) => {
        if (isCommitted) track('library_action', { action });
      });
      showUndoToast({
        key: title.mediaItemId,
        message: spec.message,
        description: spec.description,
        undoLabel: dict.my.toast.undo,
        onUndo: () => {
          void committed.then((isCommitted) => {
            if (!isCommitted) return;
            const undoToken = isMove ? moves.track(title.mediaItemId, from ?? 'gone') : undefined;
            if (isMove) lists.move({ from: to, to: from });
            return settle(spec, spec.revert, undoToken);
          });
        },
      });
    },
    [dict, lists, moves, settle],
  );

  const removeFromLibrary = useCallback(
    (title: LibraryTitle, from: LibraryList) => {
      const { mediaItemId } = title;
      const token = moves.track(mediaItemId, 'gone');
      lists.move({ from });
      remove(title, {
        onUndo: () => {
          lists.move({ to: from });
          moves.forget(mediaItemId, token);
        },
        onSettled: () => moves.forget(mediaItemId, token),
      });
    },
    [lists, moves, remove],
  );

  return useMemo(() => {
    const specs = moveSpecs(dict);
    return {
      refresh,
      removeFromLibrary,
      pause: (...args) => run('pause', specs.pause(...args)),
      drop: (...args) => run('drop', specs.drop(...args)),
      dropPaused: (...args) => run('dropPaused', specs.dropPaused(...args)),
      restore: (...args) => run('restore', specs.restore(...args)),
      start: (...args) => run('start', specs.start(...args)),
      markMovieWatched: (...args) => run('markMovieWatched', specs.markMovieWatched(...args)),
      removeFromPlan: (...args) => run('removeFromPlan', specs.removeFromPlan(...args)),
      markEpisodeWatched: (...args) => run('markEpisodeWatched', specs.markEpisodeWatched(...args)),
      rate: (...args) => run('rate', specs.rate(...args)),
    } satisfies LibraryActions;
  }, [dict, refresh, removeFromLibrary, run]);
}
