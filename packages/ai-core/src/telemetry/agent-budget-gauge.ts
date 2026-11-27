import type { Meter } from '@opentelemetry/api';

import { AI_METRIC_ATTRIBUTES, AI_METRIC_NAMES, AI_METRIC_UNITS } from './ai-metric-names';

export interface AgentBudget {
  agent: string;
  perDayUsd: number;
}

export const registerAgentBudgetGauge = (meter: Meter, budget: AgentBudget): void => {
  meter
    .createObservableGauge(AI_METRIC_NAMES.AGENT_BUDGET_DAY, {
      description: "The agent's daily budget from its manifest",
      unit: AI_METRIC_UNITS.COST,
    })
    .addCallback((observation) => {
      observation.observe(budget.perDayUsd, { [AI_METRIC_ATTRIBUTES.AGENT]: budget.agent });
    });
};
