import fc from 'fast-check';

import { SkipReason, SnapshotLimits } from '../constants/snapshot.constants';
import { inspectFileBody, splitLines } from './file-inspection';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('splitLines', () => {
  it('matches how an editor counts lines', () => {
    expect(splitLines('')).toEqual([]);
    expect(splitLines('a')).toEqual(['a']);
    expect(splitLines('a\n')).toEqual(['a']);
    expect(splitLines('a\n\n')).toEqual(['a', '']);
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b']);
  });

  it('gives one line per newline-terminated line', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 20 }).map((line) => line.replace(/[\r\n]/g, '')), { maxLength: 30 }), (lines) => {
        const text = lines.map((line) => `${line}\n`).join('');
        expect(splitLines(text)).toEqual(lines);
      }),
    );
  });
});

describe('inspectFileBody', () => {
  it('reads plain text', () => {
    expect(inspectFileBody(bytes('one\ntwo\n'))).toEqual({ kind: 'text', lines: ['one', 'two'] });
  });

  it('skips a binary file, an oversized file, invalid UTF-8 and minified lines', () => {
    expect(inspectFileBody(new Uint8Array([1, 2, 0, 3]))).toEqual({ kind: 'skipped', reason: SkipReason.BINARY });
    expect(inspectFileBody(new Uint8Array(SnapshotLimits.MAX_FILE_BYTES + 1).fill(97))).toEqual({
      kind: 'skipped',
      reason: SkipReason.TOO_LARGE,
    });
    expect(inspectFileBody(new Uint8Array([0xff, 0xfe, 0xfd]))).toEqual({ kind: 'skipped', reason: SkipReason.NOT_UTF8 });
    expect(inspectFileBody(bytes('x'.repeat(SnapshotLimits.MAX_LINE_CHARS + 1)))).toEqual({
      kind: 'skipped',
      reason: SkipReason.LONG_LINES,
    });
  });
});
