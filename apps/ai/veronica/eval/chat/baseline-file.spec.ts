import { buildBaseline, BASELINE_VERSION } from './baseline';
import { InvalidBaselineError, parseBaseline } from './baseline-file';
import { aggregateCase } from './aggregate';
import { EvalKind } from './eval-case';
import { runsWithPasses } from './verdict.testing';

const outcome = (caseId: string, passes: number) =>
  aggregateCase(caseId, EvalKind.KNOWN, runsWithPasses(passes, 3), { runs: 3, passAt: 2 });

const baselineOf = (passes: Record<string, number>) =>
  buildBaseline(
    Object.entries(passes).map(([id, count]) => outcome(id, count)),
    { model: 'm', judgeModel: 'j', runs: 3, passAt: 2, savedAtMs: 1 },
  );

describe('baseline file', () => {
  it('survives a round trip through JSON', () => {
    const baseline = baselineOf({ a: 3, b: 1, c: 0 });
    expect(parseBaseline(JSON.stringify(baseline))).toEqual(baseline);
    expect(baseline.version).toBe(BASELINE_VERSION);
    expect(baseline.cases.b).toEqual({ passes: 1, runs: 3, passed: false, flaky: true });
  });

  it.each([
    ['not json'],
    [JSON.stringify({ version: 2, cases: {} })],
    [JSON.stringify({ ...baselineOf({ a: 3 }), cases: { a: { passes: -1 } } })],
  ])('rejects %s', (content) => {
    expect(() => parseBaseline(content)).toThrow(InvalidBaselineError);
  });
});
