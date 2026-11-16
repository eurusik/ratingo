import type { ImportFile, ReadyFile } from './import-file';
import type { ImportItem } from './import-item';
import type { PreviewFilter } from './import-wizard';

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

export function summarizeImport(files: readonly ImportFile[]): ImportSummary {
  const ready = files.filter(isReady);
  const items = ready.flatMap((file) => file.items);
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
