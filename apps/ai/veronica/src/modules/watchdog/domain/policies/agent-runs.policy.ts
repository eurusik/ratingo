import {
  FAILED_RUNS_TO_ALERT,
  MONEY_DECIMALS,
  PERCENT,
  watchedAgentBudgetText,
  watchedAgentFailedRunsText,
  type WatchedAgent,
} from '../constants/watchdog-rules.constants';
import type { AgentRunReading } from '../entities/agent-run-stats';
import { failing, healthy, type CheckResult } from '../entities/check-result';

import { isBudgetNearlyExhausted } from './budget.policy';

export const evaluateAgentSpend = (
  watched: WatchedAgent,
  reading: AgentRunReading,
): CheckResult | null => {
  const limitUsd = reading.dayBudgetUsd;
  if (limitUsd === null) {
    return reading.spentUsd > 0 ? null : healthy(watched.budgetKey);
  }
  return isBudgetNearlyExhausted({ spentUsd: reading.spentUsd, limitUsd })
    ? failing(
        watched.budgetKey,
        watchedAgentBudgetText(
          watched.label,
          Math.round((reading.spentUsd / limitUsd) * PERCENT),
          reading.spentUsd.toFixed(MONEY_DECIMALS),
          limitUsd.toFixed(MONEY_DECIMALS),
        ),
      )
    : healthy(watched.budgetKey);
};

export const evaluateAgentFailedRuns = (
  watched: WatchedAgent,
  reading: AgentRunReading,
): CheckResult =>
  reading.failedRuns >= FAILED_RUNS_TO_ALERT
    ? failing(watched.failedRunsKey, watchedAgentFailedRunsText(watched.label, reading.failedRuns))
    : healthy(watched.failedRunsKey);
