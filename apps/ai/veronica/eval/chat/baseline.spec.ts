import fc from 'fast-check';

import { aggregateCase, majorityPassAt, type CaseOutcome } from './aggregate';
import { RegressionReason, buildBaseline, diffBaseline } from './baseline';
import { EvalKind } from './eval-case';
import { runsWithPasses } from './verdict.testing';

const CONTEXT = { model: 'm', judgeModel: 'j', runs: 3, passAt: 2, savedAtMs: 1 };

const outcomeOf = (caseId: string, passes: number, runs: number): CaseOutcome =>
  aggregateCase(caseId, EvalKind.KNOWN, runsWithPasses(passes, runs), {
    runs,
    passAt: majorityPassAt(runs),
  });

const outcome = (caseId: string, passes: number): CaseOutcome => outcomeOf(caseId, passes, 3);

const baselineOf = (passes: Record<string, number>) =>
  buildBaseline(
    Object.entries(passes).map(([id, count]) => outcome(id, count)),
    CONTEXT,
  );

const ids = (changes: readonly { caseId: string }[]): string[] =>
  changes.map((change) => change.caseId);

describe('diffBaseline', () => {
  it('leaves out the cases that were not run on a partial run', () => {
    const baseline = baselineOf({ run: 3, skipped: 3 });
    expect(diffBaseline(baseline, [outcome('run', 3)], { fullRun: false }).removedCases).toEqual(
      [],
    );
    expect(diffBaseline(baseline, [outcome('run', 3)]).removedCases).toEqual(['skipped']);
  });

  it('finds newly failing, newly passing and flaky changes', () => {
    const baseline = baselineOf({ steady: 3, broke: 3, fixed: 0, wobbles: 3, calmed: 2 });
    const diff = diffBaseline(baseline, [
      outcome('steady', 3),
      outcome('broke', 0),
      outcome('fixed', 3),
      outcome('wobbles', 2),
      outcome('calmed', 3),
    ]);
    expect(ids(diff.newlyFailing)).toEqual(['broke']);
    expect(ids(diff.newlyPassing)).toEqual(['fixed']);
    expect(ids(diff.becameFlaky)).toEqual(['wobbles']);
    expect(ids(diff.stoppedBeingFlaky)).toEqual(['calmed']);
  });

  it('calls it a regression when a case that passed stably now fails, flaky or not', () => {
    const baseline = baselineOf({ solid: 3, wobbly: 3, shaky: 2 });
    const diff = diffBaseline(baseline, [
      outcome('solid', 0),
      outcome('wobbly', 1),
      outcome('shaky', 1),
    ]);
    expect(ids(diff.newlyFailing)).toEqual(['solid', 'wobbly', 'shaky']);
    expect(diff.regressions.map((regression) => [regression.caseId, regression.reason])).toEqual([
      ['solid', RegressionReason.STOPPED_PASSING],
      ['wobbly', RegressionReason.STOPPED_PASSING],
    ]);
  });

  it('softens a failure only for a case that was already flaky in the baseline', () => {
    const baseline = baselineOf({ shaky: 2 });
    expect(diffBaseline(baseline, [outcome('shaky', 1)]).regressions).toEqual([]);
    expect(ids(diffBaseline(baseline, [outcome('shaky', 0)]).regressions)).toEqual(['shaky']);
  });

  it('compares a stable case by pass rate when the number of runs differs from the baseline', () => {
    const baseline = baselineOf({ steady: 3 });
    const regressionsWith = (passes: number) =>
      diffBaseline(baseline, [outcomeOf('steady', passes, 5)]).regressions;
    expect(regressionsWith(5)).toEqual([]);
    expect(regressionsWith(4)).toEqual([]);
    expect(regressionsWith(3)[0]).toMatchObject({ reason: RegressionReason.LOST_PASSES });
    expect(regressionsWith(2)[0]).toMatchObject({ reason: RegressionReason.STOPPED_PASSING });
  });

  it('calls it a regression when a stable case loses two passes, even while it still passes', () => {
    const baseline = buildBaseline([outcomeOf('five', 5, 5)], { ...CONTEXT, runs: 5, passAt: 3 });
    expect(diffBaseline(baseline, [outcomeOf('five', 3, 5)]).regressions[0]).toMatchObject({
      reason: RegressionReason.LOST_PASSES,
    });
    expect(diffBaseline(baseline, [outcomeOf('five', 4, 5)]).regressions).toEqual([]);
  });

  it('does not call a failure that was already in the baseline a regression', () => {
    const diff = diffBaseline(baselineOf({ known: 0 }), [outcome('known', 0)]);
    expect(diff.regressions).toEqual([]);
    expect(diff.newlyFailing).toEqual([]);
  });

  it('lists cases missing from the baseline and from the run', () => {
    const diff = diffBaseline(baselineOf({ old: 3, gone: 3 }), [
      outcome('old', 3),
      outcome('fresh', 3),
    ]);
    expect(ids(diff.newCases)).toEqual(['fresh']);
    expect(diff.removedCases).toEqual(['gone']);
    expect(diff.regressions).toEqual([]);
  });

  it('counts a new case that stably fails as a regression, and one that passes as fine', () => {
    const baseline = baselineOf({ old: 3 });
    expect(
      ids(diffBaseline(baseline, [outcome('old', 3), outcome('fresh', 0)]).regressions),
    ).toEqual(['fresh']);
    expect(diffBaseline(baseline, [outcome('old', 3), outcome('fresh', 3)]).regressions).toEqual(
      [],
    );
  });

  it('finds nothing when the run equals the baseline', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 15 }),
        (counts) => {
          const outcomes = counts.map((passes, index) => outcome(`c${index}`, passes));
          const diff = diffBaseline(buildBaseline(outcomes, CONTEXT), outcomes);
          expect(diff.newlyFailing).toEqual([]);
          expect(diff.newlyPassing).toEqual([]);
          expect(diff.becameFlaky).toEqual([]);
          expect(diff.newCases).toEqual([]);
          expect(diff.removedCases).toEqual([]);
          expect(diff.regressions).toEqual([]);
        },
      ),
    );
  });

  it('flags every baseline-stable pass that now fails, however flaky the new result is', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1 }), { minLength: 1, maxLength: 12 }),
        (afterPasses) => {
          const baseline = baselineOf(
            Object.fromEntries(afterPasses.map((_, index) => [`c${index}`, 3])),
          );
          const diff = diffBaseline(
            baseline,
            afterPasses.map((passes, index) => outcome(`c${index}`, passes)),
          );
          expect(ids(diff.regressions)).toEqual(afterPasses.map((_, index) => `c${index}`));
        },
      ),
    );
  });

  it('flags a stable case exactly when it loses two or more passes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 9 }), fc.nat({ max: 9 }), (runs, seed) => {
        const after = seed % (runs + 1);
        const baseline = buildBaseline([outcomeOf('c', runs, runs)], { ...CONTEXT, runs });
        const diff = diffBaseline(baseline, [outcomeOf('c', after, runs)]);
        expect(diff.regressions.length > 0).toBe(runs - after >= 2);
      }),
    );
  });

  it('never flags a run that passes at least as often as the baseline in every case', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }))
            .map(([before, gain]) => [before, Math.min(3, before + gain)] as const),
          { maxLength: 15 },
        ),
        (pairs) => {
          const baseline = buildBaseline(
            pairs.map(([before], index) => outcome(`c${index}`, before)),
            CONTEXT,
          );
          const diff = diffBaseline(
            baseline,
            pairs.map(([, after], index) => outcome(`c${index}`, after)),
          );
          expect(diff.regressions).toEqual([]);
        },
      ),
    );
  });

  it('does not depend on the order of the cases', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })), {
          maxLength: 15,
        }),
        (pairs) => {
          const baseline = buildBaseline(
            pairs.map(([before], index) => outcome(`c${index}`, before)),
            CONTEXT,
          );
          const current = pairs.map(([, after], index) => outcome(`c${index}`, after));
          const forward = ids(diffBaseline(baseline, current).regressions).sort();
          const backward = ids(diffBaseline(baseline, [...current].reverse()).regressions).sort();
          expect(backward).toEqual(forward);
        },
      ),
    );
  });

  it('turns a pass into a failure and back, in opposite lists', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 15 }), (flags) => {
        const asOutcomes = (invert: boolean) =>
          flags.map((ok, index) => outcome(`c${index}`, ok !== invert ? 3 : 0));
        const forward = diffBaseline(buildBaseline(asOutcomes(false), CONTEXT), asOutcomes(true));
        const backward = diffBaseline(buildBaseline(asOutcomes(true), CONTEXT), asOutcomes(false));
        expect(ids(forward.newlyFailing)).toEqual(ids(backward.newlyPassing));
        expect(ids(forward.newlyPassing)).toEqual(ids(backward.newlyFailing));
      }),
    );
  });
});
