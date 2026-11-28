import fc from 'fast-check';

import {
  InvalidRepeatPolicyError,
  aggregateCase,
  assertRepeatPolicy,
  majorityPassAt,
  summarize,
} from './aggregate';
import { CaseKind } from './eval-case';
import type { RunVerdict } from './scorer';

const run = (passed: boolean, overrides: Partial<RunVerdict> = {}): RunVerdict => ({
  passed,
  failures: [],
  problem: null,
  turns: 4,
  costUsd: 0.1,
  judgeCostUsd: 0,
  verifiedFacts: 2,
  unverifiedClaims: 0,
  fabricatedCitations: 0,
  unknownsStated: 0,
  answeredHonestlyUnknown: null,
  answer: null,
  stopReason: null,
  stopDetail: null,
  toolCalls: {},
  ...overrides,
});

const policy = { runs: 3, passAt: 2 };

describe('majorityPassAt', () => {
  it('is a strict majority', () => {
    expect([1, 2, 3, 4, 5].map(majorityPassAt)).toEqual([1, 2, 2, 3, 3]);
  });
});

describe('assertRepeatPolicy', () => {
  it('accepts whole numbers with 1 <= passAt <= runs and rejects the rest', () => {
    expect(() => assertRepeatPolicy(policy)).not.toThrow();
    for (const bad of [
      { runs: 3, passAt: 4 },
      { runs: 3, passAt: 0 },
      { runs: 2.5, passAt: 1 },
      { runs: 0, passAt: 0 },
    ]) {
      expect(() => assertRepeatPolicy(bad)).toThrow(InvalidRepeatPolicyError);
    }
  });
});

describe('aggregateCase', () => {
  it('passes at the threshold and marks disagreement as flaky', () => {
    expect(
      aggregateCase('a', CaseKind.ANSWERABLE, [run(true), run(true), run(false)], policy),
    ).toMatchObject({ passes: 2, passed: true, flaky: true });
    expect(
      aggregateCase('a', CaseKind.ANSWERABLE, [run(true), run(false), run(false)], policy),
    ).toMatchObject({ passed: false, flaky: true });
    expect(
      aggregateCase('a', CaseKind.ANSWERABLE, [run(false), run(false), run(false)], policy),
    ).toMatchObject({ passed: false, flaky: false });
    expect(
      aggregateCase('a', CaseKind.ANSWERABLE, [run(true), run(true), run(true)], policy),
    ).toMatchObject({ passed: true, flaky: false });
  });

  it('counts passes exactly for any mix of runs', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 7 }), (results) => {
        const outcome = aggregateCase(
          'a',
          CaseKind.ANSWERABLE,
          results.map((passed) => run(passed)),
          { runs: results.length, passAt: 1 },
        );
        expect(outcome.passes).toBe(results.filter(Boolean).length);
        expect(outcome.flaky).toBe(outcome.passes > 0 && outcome.passes < results.length);
      }),
    );
  });
});

describe('summarize', () => {
  it('reports pass rate, flaky cases, average and maximum cost and turns', () => {
    const outcomes = [
      aggregateCase('stable', CaseKind.ANSWERABLE, [run(true), run(true), run(true)], policy),
      aggregateCase(
        'flaky',
        CaseKind.ANSWERABLE,
        [run(true, { costUsd: 0.4, turns: 10 }), run(true), run(false)],
        policy,
      ),
      aggregateCase(
        'broken',
        CaseKind.UNKNOWN,
        [
          run(false, { answeredHonestlyUnknown: false }),
          run(false, { answeredHonestlyUnknown: true }),
          run(false, { problem: 'judge' }),
        ],
        policy,
      ),
    ];

    const summary = summarize(outcomes);

    expect(summary).toMatchObject({
      cases: 3,
      runs: 9,
      passedCases: 2,
      stablePassed: 1,
      flakyPassed: 1,
      stableFailed: 1,
      flakyCases: ['flaky'],
      failedCases: ['broken'],
      maxCostUsd: 0.4,
      unscorableRuns: 1,
    });
    expect(summary.passRate).toBeCloseTo(2 / 3);
    expect(summary.averageTurns).toBeCloseTo((4 * 8 + 10) / 9);
    expect(summary.honestUnknownRate).toBeCloseTo(1 / 2);
  });
});
