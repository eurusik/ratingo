import { aggregateCase, summarize } from './aggregate';
import { buildBaseline, diffBaseline } from './baseline';
import { summarizeCalibration, CalibrationSource } from './calibration';
import { EvalKind } from './eval-case';
import { ForbiddenKind } from './forbidden-content';
import { renderCalibration, renderCase, renderDiff, renderSummary } from './report';
import { failingRun, passingRun, runsWithPasses } from './verdict.testing';

const POLICY = { runs: 3, passAt: 2 };
const outcome = (id: string, passes: number) =>
  aggregateCase(id, EvalKind.KNOWN, runsWithPasses(passes, 3), POLICY);

describe('renderCase', () => {
  it('shows passes out of runs and marks a flaky case', () => {
    expect(renderCase(outcome('steady', 3))).toBe('steady                         3/3 pass');
    expect(renderCase(outcome('wobbly', 2))).toContain('2/3 pass FLAKY');
    expect(renderCase(outcome('broken', 0))).toContain('0/3 FAIL stable');
  });

  it('explains each failed run on its own line', () => {
    const run = failingRun({
      missingTools: ['logs_search'],
      failedExpectations: [{ id: 'C1', text: 'Says X.', reason: 'X is absent' }],
      forbiddenHits: [{ kind: ForbiddenKind.LINK, match: 'http://x' }],
      wrongNumbers: ['41'],
    });
    const text = renderCase(aggregateCase('a', EvalKind.KNOWN, [passingRun(), run, run], POLICY));
    expect(text).toContain(
      'run 2: missing tools: logs_search; C1 «Says X.» — X is absent; link: «http://x»; wrong numbers: 41',
    );
    expect(text).not.toContain('run 1:');
  });
});

describe('renderSummary', () => {
  const context = {
    model: 'anthropic:m',
    judgeModel: 'anthropic:j',
    runs: 3,
    passAt: 2,
    agentCostUsd: 0.5,
    judgeCostUsd: 0.25,
    structureOnly: false,
    stoppedForCost: false,
  };

  it('prints the rates, the flaky cases and the cost split', () => {
    const text = renderSummary(
      summarize([outcome('a', 3), outcome('b', 2), outcome('c', 0)]),
      context,
    );
    expect(text).toContain('pass rate: 2/3 (67%)');
    expect(text).toContain('stable pass: 1, flaky pass: 1, flaky fail: 0, stable fail: 1');
    expect(text).toContain('flaky cases: b');
    expect(text).toContain('failed cases: c');
    expect(text).toContain('cost: $0.7500 (agent $0.5000, judge $0.2500)');
    expect(text).toContain('compare with the baseline');
  });

  it('warns when the run stopped on the cost cap and says what the stub run proves', () => {
    const text = renderSummary(summarize([]), {
      ...context,
      stoppedForCost: true,
      structureOnly: true,
    });
    expect(text).toContain('STOPPED EARLY');
    expect(text).toContain('checks the wiring, not the model');
  });
});

describe('renderDiff', () => {
  const baseline = buildBaseline([outcome('solid', 3), outcome('wobbly', 3), outcome('fixed', 0)], {
    model: 'm',
    judgeModel: 'j',
    runs: 3,
    passAt: 2,
    savedAtMs: 0,
  });

  it('lists new failures first and names the flaky ones apart', () => {
    const text = renderDiff(
      diffBaseline(baseline, [
        outcome('solid', 0),
        outcome('wobbly', 1),
        outcome('fixed', 3),
        outcome('fresh', 3),
      ]),
    );
    expect(text).toMatch(/NEW FAILURES \(not flaky\):\n {2}solid\s+3\/3 -> 0\/3/);
    expect(text).toMatch(/newly failing but flaky:\n {2}wobbly\s+3\/3 -> 1\/3/);
    expect(text).toMatch(/newly passing:\n {2}fixed\s+0\/3 -> 3\/3/);
    expect(text).toMatch(/not in the baseline:\n {2}fresh\s+new -> 3\/3/);
    expect(text).not.toContain('no new non-flaky failure');
  });

  it('says so when there is no new non-flaky failure', () => {
    expect(
      renderDiff(
        diffBaseline(baseline, [outcome('solid', 3), outcome('wobbly', 3), outcome('fixed', 0)]),
      ),
    ).toBe('no new non-flaky failure against the baseline');
  });
});

describe('renderCalibration', () => {
  const item = (id: string, meaningGood: boolean) => ({
    id,
    caseId: 'x',
    source: CalibrationSource.WRITTEN,
    meaningGood,
    note: 'a long enough note',
    answer: 'a long enough answer',
  });

  it('prints the agreement and lists the disagreements', () => {
    const report = summarizeCalibration([
      { item: item('ok', true), judgedGood: true, reasons: [], costUsd: 0.01 },
      { item: item('lenient', false), judgedGood: true, reasons: [], costUsd: 0.01 },
    ]);
    const text = renderCalibration(report);
    expect(text).toContain('1/2 (50%)');
    expect(text).toContain('BELOW THE TRUST THRESHOLD');
    expect(text).toContain('judge accepted a bad answer:\n  lenient');
  });
});
