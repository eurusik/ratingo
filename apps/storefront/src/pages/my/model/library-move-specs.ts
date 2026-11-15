import type { ReactNode } from 'react';
import type { LibraryList } from '@/entities/library';
import { episodeProgressApi, libraryApi, type SaveList } from '@/shared/api';
import { interpolate, type Dictionary } from '@/shared/i18n';
import type { LibraryTitle } from './library-title';
import type { PlanRow } from './plan-order';

export interface MoveSpec {
  title: LibraryTitle;
  from?: LibraryList;
  to?: LibraryList;
  message: string;
  description?: ReactNode;
  commit: () => Promise<unknown>;
  revert: () => Promise<unknown>;
}

export interface EpisodeTarget {
  title: LibraryTitle;
  episodeId: string;
  code: string;
}

type ShelfList = 'paused' | 'dropped';

async function saveTo(mediaItemId: string, lists: readonly SaveList[]): Promise<void> {
  for (const list of lists) await libraryApi.save(mediaItemId, list);
}

async function unsaveFrom(mediaItemId: string, lists: readonly SaveList[]): Promise<void> {
  for (const list of lists) await libraryApi.unsave(mediaItemId, list);
}

function backToPlan(row: PlanRow) {
  return async () => {
    await saveTo(row.title.mediaItemId, row.lists);
    await libraryApi.setState(row.title.mediaItemId, 'planned', row.title.type);
  };
}

const shelve: Record<ShelfList, (title: LibraryTitle) => Promise<unknown>> = {
  paused: (title) => libraryApi.pause(title.mediaItemId),
  dropped: (title) => libraryApi.setState(title.mediaItemId, 'dropped', title.type),
};

const unshelve: Record<ShelfList, (title: LibraryTitle) => Promise<unknown>> = {
  paused: (title) => libraryApi.resume(title.mediaItemId),
  dropped: (title) => libraryApi.setState(title.mediaItemId, 'watching', title.type),
};

export function moveSpecs(dict: Dictionary) {
  const toast = dict.my.toast;
  const say = (template: string, title: LibraryTitle) =>
    interpolate(template, { title: title.title });

  const toShelf = (title: LibraryTitle, shelf: ShelfList): MoveSpec => ({
    title,
    from: 'watching',
    to: shelf,
    message: say(shelf === 'paused' ? toast.paused : toast.dropped, title),
    commit: () => shelve[shelf](title),
    revert: () => unshelve[shelf](title),
  });

  return {
    pause: (title: LibraryTitle) => toShelf(title, 'paused'),
    drop: (title: LibraryTitle) => toShelf(title, 'dropped'),
    restore: (title: LibraryTitle, shelf: ShelfList): MoveSpec => ({
      title,
      from: shelf,
      to: 'watching',
      message: say(toast.restored, title),
      commit: () => unshelve[shelf](title),
      revert: () => shelve[shelf](title),
    }),
    start: (row: PlanRow): MoveSpec => ({
      title: row.title,
      from: 'plan',
      to: 'watching',
      message: say(toast.started, row.title),
      commit: async () => {
        await libraryApi.startWatching(row.title.mediaItemId);
        await unsaveFrom(row.title.mediaItemId, row.lists);
      },
      revert: backToPlan(row),
    }),
    markMovieWatched: (row: PlanRow, rateAction: ReactNode): MoveSpec => ({
      title: row.title,
      from: 'plan',
      to: 'history',
      message: say(toast.movieWatched, row.title),
      description: rateAction,
      commit: async () => {
        await libraryApi.setState(row.title.mediaItemId, 'completed', row.title.type);
        await unsaveFrom(row.title.mediaItemId, row.lists);
      },
      revert: backToPlan(row),
    }),
    removeFromPlan: (row: PlanRow): MoveSpec => ({
      title: row.title,
      from: 'plan',
      message: say(toast.removed, row.title),
      commit: () => unsaveFrom(row.title.mediaItemId, row.lists),
      revert: () => saveTo(row.title.mediaItemId, row.lists),
    }),
    markEpisodeWatched: ({ title, episodeId, code }: EpisodeTarget): MoveSpec => ({
      title,
      message: interpolate(toast.episodeWatched, { title: title.title, code }),
      commit: () => episodeProgressApi.markWatched(episodeId),
      revert: () => episodeProgressApi.markUnwatched(episodeId),
    }),
    rate: (title: LibraryTitle, rating: number | null, previous: number | null): MoveSpec => ({
      title,
      message: say(toast.rated, title),
      commit: () => libraryApi.setRating(title.mediaItemId, rating, title.type),
      revert: () => libraryApi.setRating(title.mediaItemId, previous, title.type),
    }),
  };
}

export type MoveSpecs = ReturnType<typeof moveSpecs>;
