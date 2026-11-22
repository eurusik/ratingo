import {
  AlertKey,
  BUDGET_ALERT_RATIO,
  MONEY_DECIMALS,
  PERCENT,
  budgetAgentText,
  budgetChatText,
} from '../constants/watchdog-rules.constants';
import { failing, healthy, type CheckResult } from '../entities/check-result';

export interface BudgetReading {
  spentUsd: number;
  limitUsd: number;
}

export const isBudgetNearlyExhausted = ({ spentUsd, limitUsd }: BudgetReading): boolean =>
  limitUsd > 0 && spentUsd >= limitUsd * BUDGET_ALERT_RATIO;

const evaluate = (
  key: AlertKey,
  reading: BudgetReading,
  text: (percent: number, spentUsd: string, limitUsd: string) => string,
): CheckResult =>
  isBudgetNearlyExhausted(reading)
    ? failing(
        key,
        text(
          Math.round((reading.spentUsd / reading.limitUsd) * PERCENT),
          reading.spentUsd.toFixed(MONEY_DECIMALS),
          reading.limitUsd.toFixed(MONEY_DECIMALS),
        ),
      )
    : healthy(key);

export const evaluateAgentBudget = (reading: BudgetReading): CheckResult =>
  evaluate(AlertKey.BUDGET_AGENT, reading, budgetAgentText);

export const evaluateChatBudget = (reading: BudgetReading): CheckResult =>
  evaluate(AlertKey.BUDGET_CHAT, reading, budgetChatText);
