import type { CsvRecord, CsvTable } from '@/pages/settings/lib/import/csv-table';
import {
  FILE_KIND_STATE,
  hasIdentifier,
  type ImportFileKind,
  type ImportItem,
  type ParsedFile,
} from './import-item';

export interface ImportFormat {
  detect: (table: CsvTable) => ImportFileKind | undefined;
  toItem: (record: CsvRecord, kind: ImportFileKind) => Omit<ImportItem, 'state'>;
  isTitleRow?: (record: CsvRecord) => boolean;
}

export function hasHeaders(table: CsvTable, required: readonly string[]): boolean {
  return required.every((header) => table.headers.includes(header));
}

export function kindByRatedRows(table: CsvTable, ratingHeader: string): ImportFileKind | undefined {
  if (table.records.length === 0) return undefined;
  return table.records.every((record) => record[ratingHeader]) ? 'ratings' : 'watchlist';
}

export function parseWithFormat(
  table: CsvTable,
  kind: ImportFileKind,
  format: ImportFormat,
): ParsedFile {
  const items: ImportItem[] = [];
  let skippedRows = 0;
  for (const record of table.records) {
    const item = format.toItem(record, kind);
    const isTitle = format.isTitleRow?.(record) ?? true;
    if (!isTitle || !hasIdentifier(item)) {
      skippedRows++;
      continue;
    }
    items.push({ ...item, state: FILE_KIND_STATE[kind] });
  }
  return { items, skippedRows };
}
