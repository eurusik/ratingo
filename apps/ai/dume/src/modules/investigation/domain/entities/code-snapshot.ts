import type { SkipReason } from '../constants/snapshot.constants';

export interface SnapshotFile {
  path: string;
  bytes: number;
  lineCount: number;
}

export interface CodeSnapshot {
  readonly ref: string;
  readonly sha: string;
  files(): readonly SnapshotFile[];
  fileAt(path: string): SnapshotFile | undefined;
  skippedReasonOf(path: string): SkipReason | undefined;
  skippedCount(): number;
  readLines(path: string): Promise<readonly string[] | undefined>;
}
