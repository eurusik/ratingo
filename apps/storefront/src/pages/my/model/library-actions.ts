'use client';

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { EPISODE_PROGRESS_QUERY_KEY } from '@/entities/episode';
import { useLibraryListsStore, useLibraryStore, useMediaStateStore } from '@/entities/library';
import { CALENDAR_QUERY_KEY } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import { moveSpecs, type MoveSpec, type MoveSpecs } from './library-move-specs';
import { useLibraryMoves } from './library-moves';

type Act<K extends keyof MoveSpecs> = (...args: Parameters<MoveSpecs[K]>) => void;

export type LibraryActions = { [K in keyof MoveSpecs]: Act<K> } & {
  refresh: () => Promise<void>;
};

export function useLibraryActions(): LibraryActions {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const lists = useLibraryListsStore();
  const saveStatuses = useLibraryStore();
  const mediaStates = useMediaStateStore();
  const moves = useLibraryMoves();

  const refresh = useCallback(async () => {
    await Promise.all([
      lists.refresh(),
      queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: EPISODE_PROGRESS_QUERY_KEY }),
    ]);
  }, [lists, queryClient]);

  const settle = useCallback(
    async (spec: MoveSpec, change: Promise<unknown>, token?: number) => {
      const { mediaItemId } = spec.title;
      try {
        await change;
      } catch (error) {
        console.error('Updating the library failed', { mediaItemId, error });
        toast.danger(dict.my.toast.failed);
      } finally {
        mediaStates.refresh(mediaItemId);
        saveStatuses.refresh(mediaItemId);
        await refresh();
        if (token !== undefined) moves.forget(mediaItemId, token);
      }
    },
    [dict, mediaStates, moves, refresh, saveStatuses],
  );

  const run = useCallback(
    (spec: MoveSpec) => {
      const { title, from, to } = spec;
      const isMove = from !== to;
      const token = isMove ? moves.track(title.mediaItemId, to ?? 'gone') : undefined;
      if (isMove) lists.move({ from, to });
      const committed = spec.commit();
      void settle(spec, committed, token);
      showUndoToast({
        key: title.mediaItemId,
        message: spec.message,
        description: spec.description,
        undoLabel: dict.my.toast.undo,
        onUndo: () => {
          const undoToken = isMove ? moves.track(title.mediaItemId, from ?? 'gone') : undefined;
          if (isMove) lists.move({ from: to, to: from });
          void settle(
            spec,
            committed.then(spec.revert, () => undefined),
            undoToken,
          );
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
      restore: (...args) => run(specs.restore(...args)),
      start: (...args) => run(specs.start(...args)),
      markMovieWatched: (...args) => run(specs.markMovieWatched(...args)),
      removeFromPlan: (...args) => run(specs.removeFromPlan(...args)),
      markEpisodeWatched: (...args) => run(specs.markEpisodeWatched(...args)),
      rate: (...args) => run(specs.rate(...args)),
    } satisfies LibraryActions;
  }, [dict, refresh, run]);
}
