import type { ImportFile, ReadyFile } from './import-file';
import type { ImportItem } from './import-item';
import type { PreviewFilter } from './import-wizard';

export const MAX_IMPORT_ITEMS = 10_000;

export interface ImportSummary {
  items: ImportItem[];
  ratings: number;
  watchlist: number;
  skippedRows: number;
  ratedShows: number;
  hasUntypedRatings: boolean;
}

const isReady = (file: ImportFile): file is ReadyFile => file.status === 'ready';
const isRated = (item: ImportItem) => item.state === 'completed';

const PRIORITY = { rated: 2, watched: 1, planned: 0 } as const;

function priority(item: ImportItem): number {
  if (item.rating !== undefined) return PRIORITY.rated;
  return isRated(item) ? PRIORITY.watched : PRIORITY.planned;
}

function identity(item: ImportItem): string {
  return item.imdbId ?? `tmdb:${item.tmdbId ?? ''}`;
}

export function uniqueItems(items: readonly ImportItem[]): ImportItem[] {
  const byId = new Map<string, ImportItem>();
  for (const item of items) {
    const key = identity(item);
    const current = byId.get(key);
    if (!current || priority(item) > priority(current)) byId.set(key, item);
  }
  return [...byId.values()];
}

export function summarizeImport(files: readonly ImportFile[]): ImportSummary {
  const ready = files.filter(isReady);
  const items = uniqueItems(ready.flatMap((file) => file.items));
  const rated = items.filter(isRated);
  return {
    items,
    ratings: rated.length,
    watchlist: items.length - rated.length,
    skippedRows: ready.reduce((sum, file) => sum + file.skippedRows, 0),
    ratedShows: rated.filter((item) => item.kind === 'show').length,
    hasUntypedRatings: rated.some((item) => item.kind === undefined),
  };
}

export function filterItems(items: readonly ImportItem[], filter: PreviewFilter): ImportItem[] {
  if (filter === 'all') return [...items];
  return items.filter((item) => isRated(item) === (filter === 'ratings'));
}
