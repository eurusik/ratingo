import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { SkipReason } from '../../domain/constants/snapshot.constants';
import type { CodeSnapshot, SnapshotFile } from '../../domain/entities/code-snapshot';
import { splitLines } from '../../domain/policies/file-inspection';

const compareByPath = (left: SnapshotFile, right: SnapshotFile): number =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0;

export class DirectorySnapshot implements CodeSnapshot {
  private readonly sorted: readonly SnapshotFile[];
  private readonly byPath: ReadonlyMap<string, SnapshotFile>;

  constructor(
    readonly ref: string,
    readonly sha: string,
    private readonly root: string,
    files: readonly SnapshotFile[],
    private readonly skipped: ReadonlyMap<string, SkipReason>,
  ) {
    this.sorted = [...files].sort(compareByPath);
    this.byPath = new Map(this.sorted.map((file) => [file.path, file]));
  }

  files(): readonly SnapshotFile[] {
    return this.sorted;
  }

  fileAt(filePath: string): SnapshotFile | undefined {
    return this.byPath.get(filePath);
  }

  skippedReasonOf(filePath: string): SkipReason | undefined {
    return this.skipped.get(filePath);
  }

  skippedCount(): number {
    return this.skipped.size;
  }

  async readLines(filePath: string): Promise<readonly string[] | undefined> {
    if (!this.byPath.has(filePath)) return undefined;
    const absolute = path.resolve(this.root, filePath);
    if (!absolute.startsWith(`${this.root}${path.sep}`)) return undefined;
    try {
      return splitLines(await readFile(absolute, 'utf8'));
    } catch {
      return undefined;
    }
  }
}
