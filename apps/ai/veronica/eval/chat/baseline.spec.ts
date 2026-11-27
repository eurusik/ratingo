import fc from 'fast-check';

import { aggregateCase, type CaseOutcome } from './aggregate';
import { buildBaseline, diffBaseline } from './baseline';
import { EvalKind } from './eval-case';
import { runsWithPasses } from './verdict.testing';

const POLICY = { runs: 3, passAt: 2 };
const CONTEXT = { model: 'm', judgeModel: 'j', runs: 3, passAt: 2, savedAtMs: 1 };

const outcome = (caseId: string, passes: number): CaseOutcome =>
  aggregateCase(caseId, EvalKind.KNOWN, runsWithPasses(passes, 3), POLICY);

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

  it('treats a new failure as a regression only when it is not flaky', () => {
    const baseline = baselineOf({ solid: 3, wobbly: 3 });
    const diff = diffBaseline(baseline, [outcome('solid', 0), outcome('wobbly', 1)]);
    expect(ids(diff.newlyFailing)).toEqual(['solid', 'wobbly']);
    expect(ids(diff.regressions)).toEqual(['solid']);
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

  it('puts every regression among the newly failing or the new cases, never flaky', () => {
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
          const diff = diffBaseline(
            baseline,
            pairs.map(([, after], index) => outcome(`c${index}`, after)),
          );
          const allowed = new Set([...ids(diff.newlyFailing), ...ids(diff.newCases)]);
          for (const change of diff.regressions) {
            expect(allowed.has(change.caseId)).toBe(true);
            expect(change.after.flaky).toBe(false);
            expect(change.after.passed).toBe(false);
          }
          expect(new Set(ids(diff.newlyFailing)).size).toBe(diff.newlyFailing.length);
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
