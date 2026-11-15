import type { LibraryCounts } from '@/shared/api';
import { myListRoute } from '@/shared/config';

export const LIBRARY_LISTS = ['watching', 'plan', 'history', 'paused', 'dropped'] as const;

export type LibraryList = (typeof LIBRARY_LISTS)[number];

export const DEFAULT_LIBRARY_LIST: LibraryList = 'watching';

export const MAIN_LIBRARY_LISTS = ['watching', 'plan', 'history'] as const;

export const SHELF_LIBRARY_LISTS = ['paused', 'dropped'] as const;

type CountField = keyof LibraryCounts;

const COUNT_FIELDS: Record<LibraryList, readonly [CountField, ...CountField[]]> = {
  watching: ['watching', 'caughtUp'],
  plan: ['forLater', 'considering'],
  history: ['completed'],
  paused: ['paused'],
  dropped: ['dropped'],
};

export function libraryListRoute(list: LibraryList): string {
  return myListRoute(list, DEFAULT_LIBRARY_LIST);
}

export function isLibraryList(value: string | null | undefined): value is LibraryList {
  return LIBRARY_LISTS.some((list) => list === value);
}

export function listCount(counts: LibraryCounts, list: LibraryList): number {
  return COUNT_FIELDS[list].reduce((total, field) => total + counts[field], 0);
}

export interface LibraryMove {
  from?: LibraryList;
  to?: LibraryList;
}

function withOneLess(counts: LibraryCounts, list: LibraryList): LibraryCounts {
  const field = COUNT_FIELDS[list].find((candidate) => counts[candidate] > 0);
  return field ? { ...counts, [field]: counts[field] - 1 } : counts;
}

function withOneMore(counts: LibraryCounts, list: LibraryList): LibraryCounts {
  const [field] = COUNT_FIELDS[list];
  return { ...counts, [field]: counts[field] + 1 };
}

export function applyMove(counts: LibraryCounts, { from, to }: LibraryMove): LibraryCounts {
  if (from === to) return counts;
  const left = from ? withOneLess(counts, from) : counts;
  return to ? withOneMore(left, to) : left;
}
