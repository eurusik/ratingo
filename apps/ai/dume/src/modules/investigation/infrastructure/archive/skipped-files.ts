import { SkipReason, SnapshotLimits } from '../../domain/constants/snapshot.constants';

export class SkippedFiles {
  private readonly reasons = new Map<string, SkipReason>();
  private total = 0;

  record(path: string, reason: SkipReason): void {
    this.total += 1;
    if (this.reasons.size < SnapshotLimits.MAX_SKIPPED_ENTRIES) {
      this.reasons.set(path.slice(0, SnapshotLimits.MAX_PATH_CHARS), reason);
    }
  }

  reasonOf(path: string): SkipReason | undefined {
    return this.reasons.get(path);
  }

  count(): number {
    return this.total;
  }
}
