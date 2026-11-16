import { readCsvTable } from '@/pages/settings/lib/import/csv-table';
import { parseWithFormat } from './import-format';
import type { ImportFileKind, ImportItem } from './import-item';
import { SOURCE_FORMATS, type ImportSource } from './import-sources';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CSV_EXTENSION = /\.csv$/i;
const CSV_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel']);

type FileProblem = 'tooLarge' | 'notCsv' | 'wrongSource' | 'empty';

interface FileIdentity {
  id: string;
  name: string;
}

export interface ReadyFile extends FileIdentity {
  status: 'ready';
  kind: ImportFileKind;
  items: ImportItem[];
  skippedRows: number;
}

interface RejectedFile extends FileIdentity {
  status: 'rejected';
  problem: FileProblem;
}

export type ImportFile = ReadyFile | RejectedFile;

type CsvVerdict = Omit<ReadyFile, keyof FileIdentity | 'status'> | { problem: FileProblem };

export function inspectCsv(text: string, source: ImportSource): CsvVerdict {
  const table = readCsvTable(text);
  const format = SOURCE_FORMATS[source];
  const kind = format.detect(table);
  if (!kind) return { problem: 'wrongSource' };
  const parsed = parseWithFormat(table, kind, format);
  if (parsed.items.length === 0) return { problem: 'empty' };
  return { kind, ...parsed };
}

function isCsv(file: File): boolean {
  return CSV_EXTENSION.test(file.name) || CSV_MIME_TYPES.has(file.type);
}

function fileId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export async function readImportFile(file: File, source: ImportSource): Promise<ImportFile> {
  const identity = { id: fileId(file), name: file.name };
  if (!isCsv(file)) return { ...identity, status: 'rejected', problem: 'notCsv' };
  if (file.size > MAX_FILE_BYTES) return { ...identity, status: 'rejected', problem: 'tooLarge' };
  const verdict = inspectCsv(await file.text(), source);
  if ('problem' in verdict) return { ...identity, status: 'rejected', problem: verdict.problem };
  return { ...identity, status: 'ready', ...verdict };
}
