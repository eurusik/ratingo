'use client';

import { useCallback, useMemo } from 'react';
import { toast } from '@heroui/react';
import { useRefreshWatchProgress } from '@/entities/episode';
import { useLibraryListsStore, useLibraryStore, useMediaStateStore } from '@/entities/library';
import { useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import { moveSpecs, type MoveSpec, type MoveSpecs } from './library-move-specs';
import { useLibraryMoveActions } from './library-moves';

type Act<K extends keyof MoveSpecs> = (...args: Parameters<MoveSpecs[K]>) => void;

export type LibraryActions = { [K in keyof MoveSpecs]: Act<K> } & {
  refresh: () => Promise<void>;
};

export function useLibraryActions(): LibraryActions {
  const { dict } = useTranslation();
  const lists = useLibraryListsStore();
  const saveStatuses = useLibraryStore();
  const mediaStates = useMediaStateStore();
  const moves = useLibraryMoveActions();
  const refreshWatchProgress = useRefreshWatchProgress();

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
    (spec: MoveSpec) => {
      const { title, from, to } = spec;
      const isMove = from !== to;
      const token = isMove ? moves.track(title.mediaItemId, to ?? 'gone') : undefined;
      if (isMove) lists.move({ from, to });
      const committed = settle(spec, spec.commit, token);
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

  return useMemo(() => {
    const specs = moveSpecs(dict);
    return {
      refresh,
      pause: (...args) => run(specs.pause(...args)),
      drop: (...args) => run(specs.drop(...args)),
      dropPaused: (...args) => run(specs.dropPaused(...args)),
      restore: (...args) => run(specs.restore(...args)),
      start: (...args) => run(specs.start(...args)),
      markMovieWatched: (...args) => run(specs.markMovieWatched(...args)),
      removeFromPlan: (...args) => run(specs.removeFromPlan(...args)),
      markEpisodeWatched: (...args) => run(specs.markEpisodeWatched(...args)),
      rate: (...args) => run(specs.rate(...args)),
    } satisfies LibraryActions;
  }, [dict, refresh, run]);
}
