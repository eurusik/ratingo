import type { MetricSample, MetricsPort } from '@ratingo/ai-ops-tools';

import { FAILED_RUN_OUTCOMES } from '../../domain/constants/watchdog-rules.constants';
import type { AgentRunReading, AgentRunStats } from '../../domain/entities/agent-run-stats';
import type { AgentRunStatsPort } from '../../domain/ports/agent-run-stats.port';

export const SPEND_QUERY = 'sum by (agent) (increase(app_ai_run_cost_USD_sum[24h]))';
export const FAILED_RUNS_QUERY = `sum by (agent) (increase(app_ai_runs_total{outcome=~"${FAILED_RUN_OUTCOMES}"}[1h]))`;
export const BUDGET_QUERY =
  'max by (agent) (max_over_time({__name__=~"app_ai_agent_budget_day(_USD)?"}[1h]))';

const AGENT_LABEL = 'agent';

const byAgent = (samples: readonly MetricSample[]): Map<string, number> =>
  new Map(
    samples.flatMap((sample) => {
      const agent = sample.labels[AGENT_LABEL];
      return agent === undefined ? [] : [[agent, sample.value] as const];
    }),
  );

export class PrometheusAgentRunStats implements AgentRunStatsPort {
  constructor(private readonly metrics: MetricsPort) {}

  async read(agents: readonly string[], nowMs: number): Promise<AgentRunStats> {
    const [spent, failed, budget] = await Promise.all([
      this.metrics.instant(SPEND_QUERY, nowMs).then(byAgent),
      this.metrics.instant(FAILED_RUNS_QUERY, nowMs).then(byAgent),
      this.metrics.instant(BUDGET_QUERY, nowMs).then(byAgent),
    ]);
    return new Map(
      agents.map((agent): [string, AgentRunReading] => [
        agent,
        {
          spentUsd: spent.get(agent) ?? 0,
          failedRuns: Math.round(failed.get(agent) ?? 0),
          dayBudgetUsd: budget.get(agent) ?? null,
        },
      ]),
    );
  }
}
