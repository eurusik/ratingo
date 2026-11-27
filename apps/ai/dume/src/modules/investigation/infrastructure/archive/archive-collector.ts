import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { SkipReason, SnapshotLimits } from '../../domain/constants/snapshot.constants';
import type { SnapshotFile } from '../../domain/entities/code-snapshot';
import { inspectFileBody } from '../../domain/policies/file-inspection';
import { normalizeFilePath } from '../../domain/policies/repo-path';
import { SkippedFiles } from './skipped-files';
import type { TarEntry } from './tar-reader';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export class ArchiveCollector {
  readonly files: SnapshotFile[] = [];
  readonly skipped = new SkippedFiles();
  private unpackedBytes = 0;
  private fileCount = 0;

  constructor(private readonly directory: string) {}

  decide(entry: TarEntry): 'read' | 'skip' {
    const relative = stripArchiveRoot(entry.path);
    if (relative === undefined) return 'skip';
    if (
      this.fileCount >= SnapshotLimits.MAX_FILES ||
      this.unpackedBytes + entry.size > SnapshotLimits.MAX_UNPACKED_BYTES
    ) {
      this.skipped.record(relative, SkipReason.LIMIT_REACHED);
      return 'skip';
    }
    if (entry.size > SnapshotLimits.MAX_FILE_BYTES) {
      this.skipped.record(relative, SkipReason.TOO_LARGE);
      return 'skip';
    }
    return 'read';
  }

  async receive(entry: TarEntry, body: Buffer): Promise<void> {
    const relative = stripArchiveRoot(entry.path);
    if (relative === undefined) return;
    const normalized = normalizeFilePath(relative);
    if (!normalized.ok) {
      this.skipped.record(relative, SkipReason.UNSAFE_PATH);
      return;
    }
    const inspection = inspectFileBody(body);
    if (inspection.kind === 'skipped') {
      this.skipped.record(normalized.path, inspection.reason);
      return;
    }
    const target = path.resolve(this.directory, normalized.path);
    if (!target.startsWith(`${this.directory}${path.sep}`)) {
      this.skipped.record(normalized.path, SkipReason.UNSAFE_PATH);
      return;
    }
    try {
      await mkdir(path.dirname(target), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
      await writeFile(target, body, { flag: 'wx', mode: PRIVATE_FILE_MODE });
    } catch {
      this.skipped.record(normalized.path, SkipReason.UNSAFE_PATH);
      return;
    }
    this.fileCount += 1;
    this.unpackedBytes += body.byteLength;
    this.files.push({
      path: normalized.path,
      bytes: body.byteLength,
      lineCount: inspection.lines.length,
    });
  }
}

const stripArchiveRoot = (entryPath: string): string | undefined => {
  const slash = entryPath.indexOf('/');
  return slash === -1 || slash === entryPath.length - 1 ? undefined : entryPath.slice(slash + 1);
};
