import fc from 'fast-check';

import { ReadLimits } from '../constants/investigation.constants';
import { RangeRejection, resolveLineRange } from './line-range';

describe('resolveLineRange', () => {
  it('defaults to the start of the file with a bounded number of lines', () => {
    expect(resolveLineRange({}, 1000)).toEqual({
      ok: true,
      startLine: 1,
      endLine: ReadLimits.DEFAULT_LINES,
      cappedByLimit: false,
    });
    expect(resolveLineRange({}, 20)).toEqual({
      ok: true,
      startLine: 1,
      endLine: 20,
      cappedByLimit: false,
    });
  });

  it('rejects an empty file, a start past the end and an inverted range', () => {
    expect(resolveLineRange({}, 0)).toEqual({ ok: false, reason: RangeRejection.EMPTY_FILE });
    expect(resolveLineRange({ startLine: 21 }, 20)).toEqual({
      ok: false,
      reason: RangeRejection.START_BEYOND_END_OF_FILE,
    });
    expect(resolveLineRange({ startLine: 9, endLine: 3 }, 20)).toEqual({
      ok: false,
      reason: RangeRejection.END_BEFORE_START,
    });
  });

  it('always returns whole lines inside the file and never more than the request limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.option(fc.integer({ min: 1, max: 6000 }), { nil: undefined }),
        fc.option(fc.integer({ min: 1, max: 6000 }), { nil: undefined }),
        (total, startLine, endLine) => {
          const result = resolveLineRange({ startLine, endLine }, total);
          if (!result.ok) return;
          expect(result.startLine).toBeGreaterThanOrEqual(1);
          expect(result.endLine).toBeLessThanOrEqual(total);
          expect(result.endLine).toBeGreaterThanOrEqual(result.startLine);
          expect(result.endLine - result.startLine + 1).toBeLessThanOrEqual(
            ReadLimits.MAX_LINES_REQUESTED,
          );
        },
      ),
    );
  });
});
