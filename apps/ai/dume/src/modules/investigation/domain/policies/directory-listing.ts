import type { SnapshotFile } from '../entities/code-snapshot';
import { isUnderDirectory } from './repo-path';

export const ListedKind = {
  DIRECTORY: 'directory',
  FILE: 'file',
} as const;
export type ListedKind = (typeof ListedKind)[keyof typeof ListedKind];

export interface ListedEntry {
  name: string;
  kind: ListedKind;
  files?: number;
  lines?: number;
}

const SEPARATOR = '/';

export const listDirectoryLevel = (
  files: readonly SnapshotFile[],
  directory: string,
): ListedEntry[] => {
  const prefixLength = directory === '' ? 0 : directory.length + 1;
  const directories = new Map<string, number>();
  const entries: ListedEntry[] = [];
  for (const file of files) {
    if (!isUnderDirectory(file.path, directory) || file.path === directory) continue;
    const rest = file.path.slice(prefixLength);
    const slash = rest.indexOf(SEPARATOR);
    if (slash === -1) {
      entries.push({ name: rest, kind: ListedKind.FILE, lines: file.lineCount });
    } else {
      const name = rest.slice(0, slash);
      directories.set(name, (directories.get(name) ?? 0) + 1);
    }
  }
  const directoryEntries = [...directories].map(([name, count]) => ({
    name,
    kind: ListedKind.DIRECTORY,
    files: count,
  }));
  return [...directoryEntries, ...entries].sort(
    (left, right) =>
      (left.kind === right.kind ? 0 : left.kind === ListedKind.DIRECTORY ? -1 : 1) ||
      (left.name < right.name ? -1 : left.name > right.name ? 1 : 0),
  );
};
