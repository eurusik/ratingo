import type { SkipReason } from '../../domain/constants/snapshot.constants';
import type { CodeSnapshot, SnapshotFile } from '../../domain/entities/code-snapshot';
import { splitLines } from '../../domain/policies/file-inspection';

export const TEST_SHA = 'c'.repeat(40);

export const inMemorySnapshot = (
  files: Readonly<Record<string, string>>,
  skipped: Readonly<Record<string, SkipReason>> = {},
): CodeSnapshot => {
  const lines = new Map(Object.entries(files).map(([path, text]) => [path, splitLines(text)]));
  const entries: SnapshotFile[] = [...lines.entries()]
    .map(([path, content]) => ({
      path,
      bytes: files[path]?.length ?? 0,
      lineCount: content.length,
    }))
    .sort((left, right) => (left.path < right.path ? -1 : 1));
  return {
    ref: 'main',
    sha: TEST_SHA,
    files: () => entries,
    fileAt: (path) => entries.find((entry) => entry.path === path),
    skippedReasonOf: (path) => skipped[path],
    skippedCount: () => Object.keys(skipped).length,
    readLines: (path) => Promise.resolve(lines.get(path)),
  };
};
