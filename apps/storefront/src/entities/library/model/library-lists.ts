import { myListRoute } from '@/shared/config';
import type { LibraryCounts } from '@/shared/api';

export const LIBRARY_LISTS = ['watching', 'plan', 'history', 'paused', 'dropped'] as const;

export type LibraryList = (typeof LIBRARY_LISTS)[number];

export const DEFAULT_LIBRARY_LIST: LibraryList = 'watching';

export const MAIN_LIBRARY_LISTS = ['watching', 'plan', 'history'] as const;

export const SHELF_LIBRARY_LISTS = ['paused', 'dropped'] as const;

export function libraryListRoute(list: LibraryList): string {
  return myListRoute(list, DEFAULT_LIBRARY_LIST);
}

export function isLibraryList(value: string | null | undefined): value is LibraryList {
  return LIBRARY_LISTS.some((list) => list === value);
}

export function listCount(counts: LibraryCounts, list: LibraryList): number {
  switch (list) {
    case 'watching':
      return counts.watching + counts.caughtUp;
    case 'plan':
      return counts.forLater + counts.considering;
    case 'history':
      return counts.completed;
    case 'paused':
      return counts.paused;
    case 'dropped':
      return counts.dropped;
  }
}

const COUNT_FIELD: Record<LibraryList, keyof LibraryCounts> = {
  watching: 'watching',
  plan: 'forLater',
  history: 'completed',
  paused: 'paused',
  dropped: 'dropped',
};

export interface LibraryMove {
  from?: LibraryList;
  to?: LibraryList;
}

function shifted(counts: LibraryCounts, list: LibraryList, delta: number): LibraryCounts {
  if (list === 'plan' && delta < 0 && counts.forLater === 0) {
    return { ...counts, considering: Math.max(0, counts.considering + delta) };
  }
  if (list === 'watching' && delta < 0 && counts.watching === 0) {
    return { ...counts, caughtUp: Math.max(0, counts.caughtUp + delta) };
  }
  const field = COUNT_FIELD[list];
  return { ...counts, [field]: Math.max(0, counts[field] + delta) };
}

export function applyMove(counts: LibraryCounts, { from, to }: LibraryMove): LibraryCounts {
  if (from === to) return counts;
  const left = from ? shifted(counts, from, -1) : counts;
  return to ? shifted(left, to, 1) : left;
}
