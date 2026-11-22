import * as fc from 'fast-check';

import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import { MAX_TRACKED_FINDINGS } from '../constants/review-limits.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import type { Finding, ValidatedFinding } from '../entities/finding';
import { FindingStatus, type TrackedFinding } from '../entities/tracked-finding';

import { fingerprintFinding } from './finding-fingerprint';
import {
  countStatuses,
  mergeTracked,
  openFindings,
  openQuestions,
  toTracked,
} from './finding-tracking';

const validated = (overrides: Partial<ValidatedFinding> = {}): ValidatedFinding => {
  const base: Finding = {
    file: 'src/cart.ts',
    line: 10,
    severity: Severity.MAJOR,
    category: FindingCategory.CORRECTNESS,
    topic: FindingTopic.LOGIC,
    kind: FindingKind.FINDING,
    checkId: null,
    failureScenario: 'Конкретний вхід і хибний результат',
    impact: 'Хто або що страждає від цього',
    message: 'Сума не округлюється',
    evidence: { path: 'src/cart.ts', line: 10, excerpt: 'const total = price * quantity;' },
    ...overrides,
  };
  return { ...base, fingerprint: fingerprintFinding(base), ...overrides };
};

const tracked = (
  status: FindingStatus,
  overrides: Partial<TrackedFinding> = {},
): TrackedFinding => ({
  ...toTracked(validated(), status),
  ...overrides,
});

describe('fingerprintFinding', () => {
  const textArb = fc.string({ minLength: 1, maxLength: 80 });

  it('does not change when the finding moves to another line', () => {
    fc.assert(
      fc.property(
        textArb,
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        (message, a, b) => {
          expect(fingerprintFinding(validated({ message, line: a }))).toBe(
            fingerprintFinding(validated({ message, line: b })),
          );
        },
      ),
    );
  });

  it('ignores letter case and spacing of the message', () => {
    fc.assert(
      fc.property(textArb, (message) => {
        const reshaped = `  ${message.toUpperCase().replace(/\s+/g, '   ')}  `;
        expect(fingerprintFinding(validated({ message }))).toBe(
          fingerprintFinding(validated({ message: reshaped })),
        );
      }),
    );
  });

  it('tells apart findings in different files or categories', () => {
    expect(fingerprintFinding(validated({ file: 'a.ts' }))).not.toBe(
      fingerprintFinding(validated({ file: 'b.ts' })),
    );
    expect(fingerprintFinding(validated({ category: FindingCategory.SECURITY }))).not.toBe(
      fingerprintFinding(validated({ category: FindingCategory.TESTS })),
    );
  });
});

describe('mergeTracked', () => {
  it('marks a model finding that matches no earlier one as new', () => {
    const result = mergeTracked([], [validated()]);
    expect(result.map((entry) => entry.status)).toEqual([FindingStatus.NEW]);
  });

  it('does not report an earlier open finding again, even reworded on the same code', () => {
    const earlier = tracked(FindingStatus.STILL_OPEN);
    const reworded = validated({ message: 'Інакше сформульований опис того самого' });
    const result = mergeTracked([earlier], [reworded]);
    expect(result).toEqual([earlier]);
  });

  it('confirms a finding that needed a re-check when the model reports it again', () => {
    const result = mergeTracked([tracked(FindingStatus.NEEDS_RECHECK)], [validated()]);
    expect(result.map((entry) => entry.status)).toEqual([FindingStatus.STILL_OPEN]);
  });

  it('reports a new finding even when its twin was already resolved', () => {
    const result = mergeTracked([tracked(FindingStatus.RESOLVED)], [validated()]);
    expect(result.map((entry) => entry.status).sort()).toEqual(
      [FindingStatus.NEW, FindingStatus.RESOLVED].sort(),
    );
  });

  it('keeps every carried finding and counts them by status', () => {
    const statusArb = fc.constantFrom(...Object.values(FindingStatus));
    fc.assert(
      fc.property(fc.array(statusArb, { maxLength: 20 }), (statuses) => {
        const carried = statuses.map((status, index) =>
          tracked(status, { fingerprint: `fp${index}`, excerpt: `unique excerpt ${index}` }),
        );
        const result = mergeTracked(carried, []);
        const counts = countStatuses(result);
        expect(result).toHaveLength(Math.min(carried.length, MAX_TRACKED_FINDINGS));
        expect(counts.new + counts.stillOpen + counts.resolved + counts.needsRecheck).toBe(
          result.length,
        );
      }),
    );
  });

  it('never lets resolved findings crowd out open ones when the cap applies', () => {
    const resolved = Array.from({ length: MAX_TRACKED_FINDINGS }, (_, index) =>
      tracked(FindingStatus.RESOLVED, { fingerprint: `r${index}`, excerpt: `r${index}` }),
    );
    const open = tracked(FindingStatus.STILL_OPEN, { fingerprint: 'open', excerpt: 'open' });
    const result = mergeTracked([...resolved, open], []);
    expect(result.some((entry) => entry.fingerprint === 'open')).toBe(true);
  });
});

describe('open lists', () => {
  it('split the unresolved findings from the questions', () => {
    const all = [
      tracked(FindingStatus.STILL_OPEN, { fingerprint: 'a' }),
      tracked(FindingStatus.RESOLVED, { fingerprint: 'b' }),
      tracked(FindingStatus.NEW, { fingerprint: 'c', kind: FindingKind.QUESTION }),
    ];
    expect(openFindings(all).map((entry) => entry.fingerprint)).toEqual(['a']);
    expect(openQuestions(all).map((entry) => entry.fingerprint)).toEqual(['c']);
  });
});
