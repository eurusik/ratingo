import * as fc from 'fast-check';

import { FindingKind } from '../constants/finding-classification.constants';
import { RECHECK_LINE_WINDOW } from '../constants/review-limits.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import { FindingStatus, RecheckVerdict, type TrackedFinding } from '../entities/tracked-finding';

import {
  applyRecheck,
  classifyPrevious,
  touchedFrom,
  type CarryOverContext,
} from './finding-carry-over';

const EXCERPT = 'const total = price * quantity;';
const FILE = 'src/cart.ts';

const finding = (overrides: Partial<TrackedFinding> = {}): TrackedFinding => ({
  fingerprint: 'fp1',
  file: FILE,
  line: 10,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  kind: FindingKind.FINDING,
  message: 'Сума не округлюється',
  excerpt: EXCERPT,
  status: FindingStatus.NEW,
  ...overrides,
});

const fileWith = (excerptLine: number, length = 40): string =>
  Array.from({ length }, (_, index) =>
    index + 1 === excerptLine ? `  ${EXCERPT}` : `line ${index + 1}`,
  ).join('\n');

const context = (overrides: Partial<CarryOverContext> = {}): CarryOverContext => ({
  precise: true,
  touched: { lines: new Map(), opaque: new Set() },
  headFiles: new Map([[FILE, fileWith(10)]]),
  ...overrides,
});

const touching = (...lines: number[]) => ({
  lines: new Map([[FILE, new Set(lines)]]),
  opaque: new Set<string>(),
});

describe('classifyPrevious', () => {
  it('keeps a finding open when its file was not touched, and follows the excerpt to its new line', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), (moved) => {
        const [result] = classifyPrevious(
          [finding()],
          context({ headFiles: new Map([[FILE, fileWith(moved)]]) }),
        );
        expect(result).toMatchObject({ status: FindingStatus.STILL_OPEN, line: moved });
      }),
    );
  });

  it('resolves a finding when its file was touched and the excerpt is gone', () => {
    const [result] = classifyPrevious(
      [finding()],
      context({
        touched: touching(10),
        headFiles: new Map([[FILE, 'const total = round(price * quantity);']]),
      }),
    );
    expect(result?.status).toBe(FindingStatus.RESOLVED);
  });

  it('resolves a finding whose file no longer exists at the head', () => {
    const [result] = classifyPrevious([finding()], context({ headFiles: new Map([[FILE, null]]) }));
    expect(result?.status).toBe(FindingStatus.RESOLVED);
  });

  it('asks for a re-check when the touched lines are within the window of the excerpt', () => {
    fc.assert(
      fc.property(fc.integer({ min: -RECHECK_LINE_WINDOW, max: RECHECK_LINE_WINDOW }), (offset) => {
        const [result] = classifyPrevious([finding()], context({ touched: touching(10 + offset) }));
        expect(result?.status).toBe(FindingStatus.NEEDS_RECHECK);
      }),
    );
  });

  it('keeps a finding open when the new commits touched the file far from the excerpt', () => {
    fc.assert(
      fc.property(fc.integer({ min: RECHECK_LINE_WINDOW + 1, max: 25 }), (distance) => {
        const [result] = classifyPrevious(
          [finding()],
          context({ touched: touching(10 + distance) }),
        );
        expect(result?.status).toBe(FindingStatus.STILL_OPEN);
      }),
    );
  });

  it('asks for a re-check when the diff of a touched file is not available', () => {
    const touched = touchedFrom([{ path: FILE, patch: null }]);
    const [result] = classifyPrevious([finding()], context({ touched }));
    expect(result?.status).toBe(FindingStatus.NEEDS_RECHECK);
  });

  it('never decides without the file: an unreadable file needs a re-check', () => {
    const [result] = classifyPrevious([finding()], context({ headFiles: new Map() }));
    expect(result?.status).toBe(FindingStatus.NEEDS_RECHECK);
  });

  it('asks for a re-check when the excerpt is missing from an untouched file', () => {
    const [result] = classifyPrevious(
      [finding()],
      context({ headFiles: new Map([[FILE, 'something else entirely']]) }),
    );
    expect(result?.status).toBe(FindingStatus.NEEDS_RECHECK);
  });

  it('sends every finding to a re-check in a full review', () => {
    const statuses = [FindingStatus.NEW, FindingStatus.STILL_OPEN, FindingStatus.NEEDS_RECHECK];
    fc.assert(
      fc.property(fc.constantFrom(...statuses), (status) => {
        const [result] = classifyPrevious([finding({ status })], context({ precise: false }));
        expect(result?.status).toBe(FindingStatus.NEEDS_RECHECK);
      }),
    );
  });

  it('never drops an open finding and leaves already resolved ones behind', () => {
    const statusArb = fc.constantFrom(...Object.values(FindingStatus));
    fc.assert(
      fc.property(
        fc.array(statusArb, { maxLength: 10 }),
        fc.boolean(),
        fc.constantFrom(null, EXCERPT, 'unrelated'),
        (statuses, precise, content) => {
          const previous = statuses.map((status, index) =>
            finding({ status, fingerprint: `fp${index}` }),
          );
          const result = classifyPrevious(
            previous,
            context({ precise, headFiles: new Map([[FILE, content]]) }),
          );
          const expected = previous
            .filter((entry) => entry.status !== FindingStatus.RESOLVED)
            .map((entry) => entry.fingerprint);
          expect(result.map((entry) => entry.fingerprint)).toEqual(expected);
        },
      ),
    );
  });
});

describe('applyRecheck', () => {
  const pending = finding({ status: FindingStatus.NEEDS_RECHECK });

  it('applies the verdict only to findings that needed one', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(FindingStatus)),
        fc.constantFrom(...Object.values(RecheckVerdict)),
        (status, verdict) => {
          const [result] = applyRecheck([finding({ status })], [{ fingerprint: 'fp1', verdict }]);
          if (status !== FindingStatus.NEEDS_RECHECK) {
            expect(result?.status).toBe(status);
          } else {
            expect(result?.status).toBe(
              verdict === RecheckVerdict.RESOLVED
                ? FindingStatus.RESOLVED
                : FindingStatus.STILL_OPEN,
            );
          }
        },
      ),
    );
  });

  it('keeps a finding that got no verdict as needing a re-check instead of dropping it', () => {
    expect(applyRecheck([pending], [])).toEqual([pending]);
    expect(applyRecheck([pending], [{ fingerprint: 'other', verdict: 'resolved' }])).toEqual([
      pending,
    ]);
  });
});
