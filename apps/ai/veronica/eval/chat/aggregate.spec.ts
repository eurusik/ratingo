import fc from 'fast-check';

import {
  InvalidRepeatPolicyError,
  aggregateCase,
  assertRepeatPolicy,
  asPercent,
  majorityPassAt,
  summarize,
} from './aggregate';
import { EvalKind } from './eval-case';
import { failingRun, passingRun, runsWithPasses } from './verdict.testing';

const policyArbitrary = fc
  .integer({ min: 1, max: 9 })
  .chain((runs) =>
    fc.record({ runs: fc.constant(runs), passAt: fc.integer({ min: 1, max: runs }) }),
  );

describe('majorityPassAt', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 3],
    [5, 3],
  ])('needs %i passes of %i runs to have a majority', (runs, expected) => {
    expect(majorityPassAt(runs)).toBe(expected);
  });

  it('is always a strict majority that fits in the runs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (runs) => {
        const needed = majorityPassAt(runs);
        expect(needed).toBeGreaterThan(runs / 2);
        expect(needed).toBeLessThanOrEqual(runs);
        expect(needed - 1).toBeLessThanOrEqual(runs / 2);
      }),
    );
  });
});

describe('assertRepeatPolicy', () => {
  it.each([
    { runs: 0, passAt: 1 },
    { runs: 3, passAt: 0 },
    { runs: 3, passAt: 4 },
    { runs: 2.5, passAt: 1 },
    { runs: 3, passAt: 1.5 },
  ])('rejects %j', (policy) => {
    expect(() => assertRepeatPolicy(policy)).toThrow(InvalidRepeatPolicyError);
  });

  it('accepts every whole passAt up to the number of runs', () => {
    fc.assert(fc.property(policyArbitrary, (policy) => assertRepeatPolicy(policy)));
  });
});

describe('aggregateCase', () => {
  it('passes a case on the configured majority and not below it', () => {
    const policy = { runs: 3, passAt: 2 };
    expect(aggregateCase('c', EvalKind.KNOWN, runsWithPasses(2, 3), policy).passed).toBe(true);
    expect(aggregateCase('c', EvalKind.KNOWN, runsWithPasses(1, 3), policy).passed).toBe(false);
  });

  it('marks a case flaky when its runs disagree and only then', () => {
    const policy = { runs: 3, passAt: 2 };
    const flags = [0, 1, 2, 3].map(
      (passes) => aggregateCase('c', EvalKind.KNOWN, runsWithPasses(passes, 3), policy).flaky,
    );
    expect(flags).toEqual([false, true, true, false]);
  });

  it('never calls a single run flaky', () => {
    const policy = { runs: 1, passAt: 1 };
    expect(aggregateCase('c', EvalKind.KNOWN, [passingRun()], policy).flaky).toBe(false);
    expect(aggregateCase('c', EvalKind.KNOWN, [failingRun()], policy).flaky).toBe(false);
  });

  it('counts passes, passes iff passes reach passAt, and is flaky iff the runs differ', () => {
    fc.assert(
      fc.property(policyArbitrary, fc.nat({ max: 1000 }), ({ runs, passAt }, seed) => {
        const passes = seed % (runs + 1);
        const outcome = aggregateCase('c', EvalKind.KNOWN, runsWithPasses(passes, runs), {
          runs,
          passAt,
        });
        expect(outcome.passes).toBe(passes);
        expect(outcome.passed).toBe(passes >= passAt);
        expect(outcome.flaky).toBe(passes !== 0 && passes !== runs);
      }),
    );
  });

  it('does not depend on the order of the runs', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 9 }), (results) => {
        const runs = results.map((ok) => (ok ? passingRun() : failingRun()));
        const policy = { runs: runs.length, passAt: majorityPassAt(runs.length) };
        const forward = aggregateCase('c', EvalKind.KNOWN, runs, policy);
        const backward = aggregateCase('c', EvalKind.KNOWN, [...runs].reverse(), policy);
        expect([backward.passes, backward.passed, backward.flaky]).toEqual([
          forward.passes,
          forward.passed,
          forward.flaky,
        ]);
      }),
    );
  });
});

describe('summarize', () => {
  const policy = { runs: 3, passAt: 2 };
  const outcome = (id: string, passes: number, kind: EvalKind = EvalKind.KNOWN) =>
    aggregateCase(
      id,
      kind,
      runsWithPasses(passes, 3).map((run) => ({ ...run, caseId: id, kind })),
      policy,
    );

  it('separates stable and flaky passes and failures', () => {
    const summary = summarize([outcome('a', 3), outcome('b', 2), outcome('c', 1), outcome('d', 0)]);
    expect(summary).toMatchObject({
      cases: 4,
      runs: 12,
      passedCases: 2,
      stablePassed: 1,
      flakyPassed: 1,
      flakyFailed: 1,
      stableFailed: 1,
      failedCases: ['c', 'd'],
      flakyCases: ['b', 'c'],
    });
    expect(summary.passRate).toBe(0.5);
  });

  it('counts tool selection and facts per run, not per case', () => {
    const runs = [
      passingRun(),
      passingRun({ toolsOk: false, passed: false }),
      passingRun({ factsOk: false, passed: false }),
      passingRun(),
    ];
    const summary = summarize([aggregateCase('a', EvalKind.KNOWN, runs, { runs: 4, passAt: 3 })]);
    expect(summary.toolSelectionRate).toBe(0.75);
    expect(summary.factRate).toBe(0.75);
  });

  it('reports the honest-unknown rate only when unknown cases ran', () => {
    expect(summarize([outcome('a', 3)]).unknownAnsweredHonestly).toBeNull();
    expect(
      summarize([outcome('a', 3), outcome('u', 1, EvalKind.UNKNOWN)]).unknownAnsweredHonestly,
    ).toBeCloseTo(1 / 3);
  });

  it('counts flagged numbers, wrong numbers, fallbacks and unscorable runs', () => {
    const runs = [
      passingRun({ flaggedNumbers: ['1', '2'], wrongNumbers: ['2'] }),
      passingRun({ fellBack: true }),
      passingRun({ problem: 'judge down' }),
    ];
    const summary = summarize([aggregateCase('a', EvalKind.KNOWN, runs, { runs: 3, passAt: 2 })]);
    expect(summary).toMatchObject({
      answersWithFlags: 1,
      flaggedNumbers: 2,
      wrongNumbers: 1,
      fallbacks: 1,
      unscorableRuns: 1,
    });
  });

  it('reads an empty run as perfect rates, not NaN', () => {
    expect(summarize([])).toMatchObject({ passRate: 1, toolSelectionRate: 1, factRate: 1 });
  });

  it('keeps every count consistent with the cases', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 20 }), (passesPerCase) => {
        const outcomes = passesPerCase.map((passes, index) => outcome(`c${index}`, passes));
        const summary = summarize(outcomes);
        expect(
          summary.stablePassed + summary.flakyPassed + summary.flakyFailed + summary.stableFailed,
        ).toBe(outcomes.length);
        expect(summary.passedCases).toBe(summary.stablePassed + summary.flakyPassed);
        expect(summary.failedCases).toHaveLength(outcomes.length - summary.passedCases);
        expect(summary.passRate).toBeGreaterThanOrEqual(0);
        expect(summary.passRate).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe('asPercent', () => {
  it('rounds a rate and prints n/a for no data', () => {
    expect(asPercent(0.666)).toBe('67%');
    expect(asPercent(null)).toBe('n/a');
  });
});
