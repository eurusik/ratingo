import type { CsvRecord, CsvTable } from './csv-table';
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
}

export function hasHeaders(table: CsvTable, required: readonly string[]): boolean {
  return required.every((header) => table.headers.includes(header));
}

export function kindByFirstRating(
  table: CsvTable,
  ratingHeader: string,
): ImportFileKind | undefined {
  const [first] = table.records;
  if (!first) return undefined;
  return first[ratingHeader] ? 'ratings' : 'watchlist';
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
    if (!hasIdentifier(item)) {
      skippedRows++;
      continue;
    }
    items.push({ ...item, state: FILE_KIND_STATE[kind] });
  }
  return { items, skippedRows };
}
