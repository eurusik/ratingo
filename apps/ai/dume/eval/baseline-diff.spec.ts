import { aggregateCase, type CaseOutcome } from './aggregate';
import { RegressionReason, buildBaseline, diffBaseline, type Baseline } from './baseline-diff';
import { CaseKind } from './eval-case';
import type { RunVerdict } from './scorer';

const verdict = (passed: boolean): RunVerdict => ({
  passed,
  failures: [],
  problem: null,
  turns: 1,
  costUsd: 0,
  judgeCostUsd: 0,
  verifiedFacts: 0,
  unverifiedClaims: 0,
  fabricatedCitations: 0,
  unknownsStated: 0,
  answeredHonestlyUnknown: null,
});

const outcome = (caseId: string, passes: number, runs: number): CaseOutcome =>
  aggregateCase(
    caseId,
    CaseKind.ANSWERABLE,
    Array.from({ length: runs }, (_, index) => verdict(index < passes)),
    { runs, passAt: Math.floor(runs / 2) + 1 },
  );

const baselineOf = (...outcomes: CaseOutcome[]): Baseline =>
  buildBaseline(outcomes, { savedAtMs: 1, model: 'm', judgeModel: 'j', runs: 3, passAt: 2 });

const reasonsOf = (baseline: Baseline, ...outcomes: CaseOutcome[]) =>
  diffBaseline(baseline, outcomes, { fullRun: true }).regressions.map((entry) => [
    entry.caseId,
    entry.reason,
  ]);

describe('diffBaseline', () => {
  it('flags a case that passed and no longer passes', () => {
    expect(reasonsOf(baselineOf(outcome('a', 3, 3)), outcome('a', 1, 3))).toEqual([
      ['a', RegressionReason.STOPPED_PASSING],
    ]);
    expect(reasonsOf(baselineOf(outcome('a', 3, 3)), outcome('a', 0, 3))).toEqual([
      ['a', RegressionReason.STOPPED_PASSING],
    ]);
  });

  it('lets a case that was already flaky fail some runs without blocking', () => {
    expect(reasonsOf(baselineOf(outcome('a', 2, 3)), outcome('a', 1, 3))).toEqual([]);
  });

  it('flags a stable case that loses two passes even if it still passes, scaling to the run count', () => {
    expect(reasonsOf(baselineOf(outcome('a', 5, 5)), outcome('a', 3, 5))).toEqual([
      ['a', RegressionReason.LOST_PASSES],
    ]);
    expect(reasonsOf(baselineOf(outcome('a', 3, 3)), outcome('a', 2, 3))).toEqual([]);
  });

  it('flags a flaky case that now fails every run, and ignores one that never passed', () => {
    expect(reasonsOf(baselineOf(outcome('a', 2, 3)), outcome('a', 0, 3))).toEqual([
      ['a', RegressionReason.STOPPED_PASSING],
    ]);
    expect(reasonsOf(baselineOf(outcome('a', 1, 3)), outcome('a', 0, 3))).toEqual([]);
  });

  it('flags a new case that fails every run but not a flaky one', () => {
    expect(reasonsOf(baselineOf(), outcome('new', 0, 3))).toEqual([
      ['new', RegressionReason.NEW_CASE_FAILS],
    ]);
    expect(reasonsOf(baselineOf(), outcome('new', 1, 3))).toEqual([]);
  });

  it('lists removed cases only for a full run', () => {
    const baseline = baselineOf(outcome('a', 3, 3), outcome('b', 3, 3));

    expect(diffBaseline(baseline, [outcome('a', 3, 3)], { fullRun: true }).removedCases).toEqual([
      'b',
    ]);
    expect(diffBaseline(baseline, [outcome('a', 3, 3)], { fullRun: false }).removedCases).toEqual(
      [],
    );
  });
});
