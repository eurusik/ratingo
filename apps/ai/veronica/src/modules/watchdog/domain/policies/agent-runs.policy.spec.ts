import fc from 'fast-check';

import {
  AlertKey,
  RECOVERY_TEXT,
  WATCHED_AGENTS,
  type WatchedAgent,
} from '../constants/watchdog-rules.constants';

import { evaluateAgentFailedRuns, evaluateAgentSpend } from './agent-runs.policy';

const [happy, dume] = WATCHED_AGENTS as [WatchedAgent, WatchedAgent];

describe('evaluateAgentSpend', () => {
  it('alerts at 80 percent of the agent budget and names the agent and the money', () => {
    const result = evaluateAgentSpend(dume, { spentUsd: 1.2, failedRuns: 0, dayBudgetUsd: 1.5 });

    expect(result).toEqual({
      key: AlertKey.BUDGET_DUME,
      finding: {
        key: AlertKey.BUDGET_DUME,
        text: '🟠 Бюджет DUM-E за добу: 80% ($1.20 із $1.50)',
      },
    });
  });

  it('is healthy below 80 percent', () => {
    expect(
      evaluateAgentSpend(happy, { spentUsd: 0.39, failedRuns: 0, dayBudgetUsd: 0.5 })?.finding,
    ).toBeNull();
  });

  it('cannot judge spend when the agent spent money but its budget is unknown', () => {
    expect(
      evaluateAgentSpend(happy, { spentUsd: 0.2, failedRuns: 0, dayBudgetUsd: null }),
    ).toBeNull();
  });

  it('is healthy when nothing was spent, even if the budget is unknown', () => {
    expect(
      evaluateAgentSpend(happy, { spentUsd: 0, failedRuns: 0, dayBudgetUsd: null })?.finding,
    ).toBeNull();
  });

  it('alerts for spend clearly above 80 percent and stays quiet clearly below it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        (limitUsd, ratio) => {
          fc.pre(Math.abs(ratio - 0.8) > 0.001);
          const result = evaluateAgentSpend(happy, {
            spentUsd: limitUsd * ratio,
            failedRuns: 0,
            dayBudgetUsd: limitUsd,
          });
          return (result?.finding !== null) === ratio > 0.8;
        },
      ),
    );
  });

  it('alerts at exactly 80 percent even where floating point makes 0.8 times the limit slightly larger', () => {
    expect(
      evaluateAgentSpend(dume, { spentUsd: 1.2, failedRuns: 0, dayBudgetUsd: 1.5 })?.finding,
    ).not.toBeNull();
  });
});

describe('evaluateAgentFailedRuns', () => {
  it.each([
    [2, false],
    [3, true],
    [9, true],
  ])('with %s failed runs an alert is %s', (failedRuns, alerts) => {
    const result = evaluateAgentFailedRuns(dume, { spentUsd: 0, failedRuns, dayBudgetUsd: 1.5 });

    expect(result.key).toBe(AlertKey.FAILED_RUNS_DUME);
    expect(result.finding !== null).toBe(alerts);
  });

  it('names the agent in the alert', () => {
    expect(
      evaluateAgentFailedRuns(happy, { spentUsd: 0, failedRuns: 4, dayBudgetUsd: 0.5 }).finding
        ?.text,
    ).toContain('Хеппі: невдалих запусків за останню годину: 4. Перевір Railway → happy → Logs');
  });
});

describe('the watched agents', () => {
  it('have their own key and recovery text for every alert', () => {
    for (const watched of WATCHED_AGENTS) {
      expect(RECOVERY_TEXT[watched.budgetKey]).toContain(watched.label);
      expect(RECOVERY_TEXT[watched.failedRunsKey]).toContain(watched.label);
    }
    expect(new Set(WATCHED_AGENTS.flatMap((w) => [w.budgetKey, w.failedRunsKey])).size).toBe(4);
  });
});
