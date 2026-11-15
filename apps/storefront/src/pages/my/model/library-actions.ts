'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import {
  useLibraryListsStore,
  useLibraryStore,
  useMediaStateStore,
  type LibraryList,
} from '@/entities/library';
import { episodeProgressApi, libraryApi, type SaveList } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import type { LibraryTitle } from './library-title';
import { useLibraryMoves } from './library-moves';
import type { PlanRow } from './plan-order';

const CALENDAR_QUERY_KEY = ['calendar'] as const;
const EPISODE_PROGRESS_QUERY_KEY = ['episode-progress'] as const;

interface MoveSpec {
  title: LibraryTitle;
  from?: LibraryList;
  to?: LibraryList;
  message: string;
  description?: ReactNode;
  commit: () => Promise<unknown>;
  revert: () => Promise<unknown>;
}

async function saveTo(mediaItemId: string, lists: readonly SaveList[]): Promise<void> {
  for (const list of lists) await libraryApi.save(mediaItemId, list);
}

async function unsaveFrom(mediaItemId: string, lists: readonly SaveList[]): Promise<void> {
  for (const list of lists) await libraryApi.unsave(mediaItemId, list);
}

interface EpisodeTarget {
  title: LibraryTitle;
  episodeId: string;
  code: string;
}

export interface LibraryActions {
  pause: (title: LibraryTitle) => void;
  drop: (title: LibraryTitle) => void;
  restore: (title: LibraryTitle, from: 'paused' | 'dropped') => void;
  start: (row: PlanRow) => void;
  markMovieWatched: (row: PlanRow, rateAction: ReactNode) => void;
  removeFromPlan: (row: PlanRow) => void;
  markEpisodeWatched: (target: EpisodeTarget) => void;
  rate: (title: LibraryTitle, rating: number | null, previous: number | null) => void;
  refresh: () => Promise<void>;
}

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
    async (title: LibraryTitle, change: Promise<unknown>) => {
      try {
        await change;
      } catch (error) {
        console.error('Updating the library failed', { mediaItemId: title.mediaItemId, error });
        toast.danger(dict.my.toast.failed);
      } finally {
        mediaStates.refresh(title.mediaItemId);
        saveStatuses.refresh(title.mediaItemId);
        await refresh();
        moves.forget(title.mediaItemId);
      }
    },
    [dict, mediaStates, moves, refresh, saveStatuses],
  );

  const run = useCallback(
    ({ title, from, to, message, description, commit, revert }: MoveSpec) => {
      if (from || to) moves.track(title.mediaItemId, to ?? 'gone');
      if (from !== to) lists.move({ from, to });
      const committed = commit();
      void settle(title, committed);
      showUndoToast({
        key: title.mediaItemId,
        message,
        description,
        undoLabel: dict.my.toast.undo,
        onUndo: () => {
          if (from !== to) lists.move({ from: to, to: from });
          void settle(
            title,
            committed.then(revert, () => undefined),
          );
        },
      });
    },
    [dict, lists, moves, settle],
  );

  return useMemo(() => {
    const say = (template: string, title: LibraryTitle) =>
      interpolate(template, { title: title.title });

    return {
      refresh,
      pause: (title) =>
        run({
          title,
          from: 'watching',
          to: 'paused',
          message: say(dict.my.toast.paused, title),
          commit: () => libraryApi.pause(title.mediaItemId),
          revert: () => libraryApi.resume(title.mediaItemId),
        }),
      drop: (title) =>
        run({
          title,
          from: 'watching',
          to: 'dropped',
          message: say(dict.my.toast.dropped, title),
          commit: () => libraryApi.setState(title.mediaItemId, 'dropped', title.type),
          revert: () => libraryApi.setState(title.mediaItemId, 'watching', title.type),
        }),
      restore: (title, from) =>
        run({
          title,
          from,
          to: 'watching',
          message: say(dict.my.toast.restored, title),
          commit: () =>
            from === 'paused'
              ? libraryApi.resume(title.mediaItemId)
              : libraryApi.setState(title.mediaItemId, 'watching', title.type),
          revert: () =>
            from === 'paused'
              ? libraryApi.pause(title.mediaItemId)
              : libraryApi.setState(title.mediaItemId, 'dropped', title.type),
        }),
      start: (row) =>
        run({
          title: row.title,
          from: 'plan',
          to: 'watching',
          message: say(dict.my.toast.started, row.title),
          commit: async () => {
            await libraryApi.startWatching(row.title.mediaItemId);
            await unsaveFrom(row.title.mediaItemId, row.lists);
          },
          revert: async () => {
            await saveTo(row.title.mediaItemId, row.lists);
            await libraryApi.setState(row.title.mediaItemId, 'planned', row.title.type);
          },
        }),
      markMovieWatched: (row, rateAction) =>
        run({
          title: row.title,
          from: 'plan',
          to: 'history',
          message: say(dict.my.toast.movieWatched, row.title),
          description: rateAction,
          commit: async () => {
            await libraryApi.setState(row.title.mediaItemId, 'completed', row.title.type);
            await unsaveFrom(row.title.mediaItemId, row.lists);
          },
          revert: async () => {
            await saveTo(row.title.mediaItemId, row.lists);
            await libraryApi.setState(row.title.mediaItemId, 'planned', row.title.type);
          },
        }),
      removeFromPlan: (row) =>
        run({
          title: row.title,
          from: 'plan',
          message: say(dict.my.toast.removed, row.title),
          commit: () => unsaveFrom(row.title.mediaItemId, row.lists),
          revert: () => saveTo(row.title.mediaItemId, row.lists),
        }),
      markEpisodeWatched: ({ title, episodeId, code }) =>
        run({
          title,
          message: interpolate(dict.my.toast.episodeWatched, { title: title.title, code }),
          commit: () => episodeProgressApi.markWatched(episodeId),
          revert: () => episodeProgressApi.markUnwatched(episodeId),
        }),
      rate: (title, rating, previous) =>
        run({
          title,
          message: say(dict.my.toast.rated, title),
          commit: () => libraryApi.setRating(title.mediaItemId, rating, title.type),
          revert: () => libraryApi.setRating(title.mediaItemId, previous, title.type),
        }),
    } satisfies LibraryActions;
  }, [dict, refresh, run]);
}
