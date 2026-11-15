import type { MediaType, SaveList, SavedItem } from '@/shared/api';
import { titleOf, type LibraryTitle } from './library-title';

export const PLAN_SORTS = ['recent', 'rating', 'releaseDate'] as const;
export type PlanSort = (typeof PLAN_SORTS)[number];

export const TYPE_FILTERS = ['all', 'movie', 'show'] as const;
export type TypeFilter = (typeof TYPE_FILTERS)[number];

export interface PlanRow {
  title: LibraryTitle;
  addedAt: number;
  lists: SaveList[];
}

function newestFirst(left: PlanRow, right: PlanRow): number {
  return right.addedAt - left.addedAt;
}

export function mergeSaved(...lists: ReadonlyArray<readonly SavedItem[]>): PlanRow[] {
  const byMedia = new Map<string, PlanRow>();
  for (const item of lists.flat()) {
    const addedAt = Date.parse(item.createdAt);
    const known = byMedia.get(item.mediaItemId);
    byMedia.set(item.mediaItemId, {
      title: known?.title ?? titleOf(item.mediaItemId, item.mediaSummary),
      addedAt: Math.max(known?.addedAt ?? addedAt, addedAt),
      lists: [...(known?.lists ?? []), item.list],
    });
  }
  return [...byMedia.values()].sort(newestFirst);
}

export function matchesType(type: MediaType, filter: TypeFilter): boolean {
  return filter === 'all' || filter === type;
}

function releaseTime(row: PlanRow): number | undefined {
  const time = row.title.releaseDate ? Date.parse(row.title.releaseDate) : Number.NaN;
  return Number.isFinite(time) ? time : undefined;
}

function comingSoonFirst(now: number) {
  return (left: PlanRow, right: PlanRow): number => {
    const leftTime = releaseTime(left);
    const rightTime = releaseTime(right);
    const leftUpcoming = leftTime !== undefined && leftTime > now;
    const rightUpcoming = rightTime !== undefined && rightTime > now;
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    if (leftUpcoming && rightUpcoming) return (leftTime ?? 0) - (rightTime ?? 0);
    return (rightTime ?? 0) - (leftTime ?? 0);
  };
}

function bestScoreFirst(left: PlanRow, right: PlanRow): number {
  return (right.title.score ?? -1) - (left.title.score ?? -1) || newestFirst(left, right);
}

export function orderPlan(
  rows: readonly PlanRow[],
  { sort, filter, now }: { sort: PlanSort; filter: TypeFilter; now: number },
): PlanRow[] {
  const visible = rows.filter((row) => matchesType(row.title.type, filter));
  if (sort === 'rating') return visible.sort(bestScoreFirst);
  if (sort === 'releaseDate') return visible.sort(comingSoonFirst(now));
  return visible.sort(newestFirst);
}
