import type { UserMediaState } from '@/shared/api';
import { titleOf, type LibraryTitle } from './library-title';

export interface HistoryRow {
  title: LibraryTitle;
  rating: number | null;
  watchedAt: string;
}

export interface HistoryMonth {
  key: string;
  rows: HistoryRow[];
}

export function toHistoryRows(items: readonly UserMediaState[]): HistoryRow[] {
  return items.flatMap((item) =>
    item.mediaSummary
      ? [
          {
            title: titleOf(item.mediaItemId, item.mediaSummary),
            rating: item.rating,
            watchedAt: item.updatedAt,
          },
        ]
      : [],
  );
}

function normalized(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');
}

export function matchesQuery(row: HistoryRow, query: string): boolean {
  const needle = normalized(query.trim());
  return needle === '' || normalized(row.title.title).includes(needle);
}

function monthKey(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function groupByMonth(rows: readonly HistoryRow[]): HistoryMonth[] {
  const months: HistoryMonth[] = [];
  for (const row of rows) {
    const key = monthKey(row.watchedAt);
    const last = months.at(-1);
    if (last?.key === key) last.rows.push(row);
    else months.push({ key, rows: [row] });
  }
  return months;
}
