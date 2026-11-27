import { SkipReason, SnapshotLimits } from '../../domain/constants/snapshot.constants';
import { SkippedFiles } from './skipped-files';

describe('SkippedFiles', () => {
  it('remembers reasons up to a cap but keeps counting past it', () => {
    const skipped = new SkippedFiles();
    for (let index = 0; index < SnapshotLimits.MAX_SKIPPED_ENTRIES + 10; index += 1) {
      skipped.record(`file-${index}`, SkipReason.BINARY);
    }

    expect(skipped.count()).toBe(SnapshotLimits.MAX_SKIPPED_ENTRIES + 10);
    expect(skipped.reasonOf('file-0')).toBe(SkipReason.BINARY);
    expect(skipped.reasonOf(`file-${SnapshotLimits.MAX_SKIPPED_ENTRIES + 5}`)).toBeUndefined();
  });

  it('cuts an over-long path before keeping it', () => {
    const skipped = new SkippedFiles();
    const long = 'a'.repeat(SnapshotLimits.MAX_PATH_CHARS + 50);

    skipped.record(long, SkipReason.TOO_LARGE);

    expect(skipped.reasonOf(long)).toBeUndefined();
    expect(skipped.reasonOf(long.slice(0, SnapshotLimits.MAX_PATH_CHARS))).toBe(
      SkipReason.TOO_LARGE,
    );
  });
});
