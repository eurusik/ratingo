import type { MediaType } from '@/shared/api';

export type ReleaseList = 'nowPlaying' | 'newOnDigital';

export const RELEASE_LISTS: readonly ReleaseList[] = ['nowPlaying', 'newOnDigital'];

export const TOP_TEN_LISTS: readonly MediaType[] = ['show', 'movie'];

export interface RailStart<K extends string, T> {
  available: readonly K[];
  first?: { list: K; items: T[] };
}

export function startRail<K extends string, T>(
  lists: Record<K, T[]>,
  order: readonly K[],
): RailStart<K, T> {
  const available = order.filter((list) => lists[list].length > 0);
  const [firstList] = available;
  return {
    available,
    first: firstList === undefined ? undefined : { list: firstList, items: lists[firstList] },
  };
}

export function activeList<K extends string>(available: readonly K[], chosen?: K): K | undefined {
  return chosen !== undefined && available.includes(chosen) ? chosen : available[0];
}
