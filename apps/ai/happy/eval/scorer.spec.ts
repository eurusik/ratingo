import * as fc from 'fast-check';

import { EvalKind, type EvalCase } from './eval-case';
import { scoreCase, summarize, type CaseResult } from './scorer';

const POSITIVE: EvalCase = {
  id: 'p',
  kind: EvalKind.POSITIVE,
  title: 'p',
  path: 'a.ts',
  lines: ['one', 'two', 'bug here', 'four'],
  expectation: { defectId: 'd', markerLine: 'bug here' },
};
const PROTECTED: EvalCase = {
  id: 'n',
  kind: EvalKind.PROTECTED_NEGATIVE,
  title: 'n',
  path: 'a.ts',
  lines: ['x'],
};
const UNKNOWN: EvalCase = {
  id: 'u',
  kind: EvalKind.UNKNOWN,
  title: 'u',
  path: 'a.ts',
  lines: ['x', 'call()'],
  expectation: { defectId: 'u', markerLine: 'call()' },
};

const result = (
  testCase: EvalCase,
  findings: number[] = [],
  questions: number[] = [],
  checkIds: (string | null)[] = [],
): CaseResult => ({
  caseId: testCase.id,
  kind: testCase.kind,
  selectedCheckIds: ['mine', 'other'],
  findings: findings.map((line, index) => ({
    file: 'a.ts',
    line,
    checkId: checkIds[index] ?? null,
  })),
  questions: questions.map((line) => ({ file: 'a.ts', line, checkId: null })),
});

describe('scoreCase', () => {
  it('counts a finding near the defect line as a true positive and the rest as false positives', () => {
    const score = scoreCase(POSITIVE, result(POSITIVE, [3, 20]));
    expect(score).toMatchObject({ truePositives: 1, falsePositives: 1, falseNegatives: 0 });
  });

  it('counts a miss as a false negative', () => {
    expect(scoreCase(POSITIVE, result(POSITIVE))).toMatchObject({
      truePositives: 0,
      falseNegatives: 1,
    });
  });

  it('treats any finding on a protected negative as a protected false positive', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 9 }), { maxLength: 6 }), (lines) => {
        const score = scoreCase(PROTECTED, result(PROTECTED, lines));
        return score.protectedFalsePositives === lines.length && score.truePositives === 0;
      }),
    );
  });

  it('expects a question, and calls a confident finding on an unknown case overconfident', () => {
    expect(scoreCase(UNKNOWN, result(UNKNOWN, [], [2]))).toMatchObject({ unknownAsQuestion: 1 });
    expect(scoreCase(UNKNOWN, result(UNKNOWN, [2], []))).toMatchObject({
      unknownAsQuestion: 0,
      unknownOverconfident: 1,
    });
  });
});

describe('off-target split', () => {
  it('separates findings on the expected check, on another selected check and outside checks', () => {
    const withCheck: EvalCase = { ...PROTECTED, checkId: 'mine' };
    const score = scoreCase(
      withCheck,
      result(withCheck, [1, 2, 3, 4], [], ['mine', 'other', null, 'mine']),
    );
    expect(score).toMatchObject({
      offTargetOnExpectedCheck: 2,
      offTargetOnOtherCheck: 1,
      offTargetOutsideChecks: 1,
      falsePositives: 4,
    });
  });

  it('does not count the hit on a positive case as off target', () => {
    const withCheck: EvalCase = { ...POSITIVE, checkId: 'mine' };
    const score = scoreCase(withCheck, result(withCheck, [3, 20], [], ['mine', 'mine']));
    expect(score).toMatchObject({ truePositives: 1, offTargetOnExpectedCheck: 1 });
  });

  it('keeps the three buckets within the false positives', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 1, max: 9 }), fc.constantFrom('mine', 'other', null)), {
          maxLength: 8,
        }),
        (entries) => {
          const score = scoreCase(
            PROTECTED,
            result(
              PROTECTED,
              entries.map(([line]) => line),
              [],
              entries.map(([, id]) => id),
            ),
          );
          return (
            score.offTargetOnExpectedCheck +
              score.offTargetOnOtherCheck +
              score.offTargetOutsideChecks <=
            score.falsePositives
          );
        },
      ),
    );
  });
});

describe('breakdown by check', () => {
  it('counts every finding under its check id, with rule or general findings under none', () => {
    const withCheck: EvalCase = { ...PROTECTED, checkId: 'mine' };
    const score = scoreCase(withCheck, result(withCheck, [1, 2, 3], [], ['mine', null, 'other']));
    expect(score.byCheck).toEqual({
      mine: { findings: 1, falsePositives: 1 },
      none: { findings: 1, falsePositives: 1 },
      other: { findings: 1, falsePositives: 1 },
    });
    expect(summarize([score, score]).byCheck.none).toEqual({ findings: 2, falsePositives: 2 });
  });

  it('does not count the hit on a positive case as a false positive', () => {
    const score = scoreCase(POSITIVE, result(POSITIVE, [3, 20], [], ['mine', 'mine']));
    expect(score.byCheck.mine).toEqual({ findings: 2, falsePositives: 1 });
  });
});

describe('summarize', () => {
  it('keeps precision and recall within zero and one', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.integer({ min: 1, max: 6 }), { maxLength: 4 }), { maxLength: 8 }),
        (runs) => {
          const metrics = summarize(
            runs.map((lines) => scoreCase(POSITIVE, result(POSITIVE, lines))),
          );
          return [metrics.precision, metrics.recall].every(
            (value) => value === null || (value >= 0 && value <= 1),
          );
        },
      ),
    );
  });

  it('reports null instead of dividing by zero', () => {
    expect(summarize([])).toMatchObject({
      precision: null,
      recall: null,
      unknownAsQuestionRate: null,
    });
  });

  it('adds up protected false positives', () => {
    const metrics = summarize([
      scoreCase(PROTECTED, result(PROTECTED, [1])),
      scoreCase(PROTECTED, result(PROTECTED, [1, 2])),
    ]);
    expect(metrics.protectedFalsePositives).toBe(3);
  });
});
