import type { MetricSample, MetricsPort } from '@ratingo/ai-ops-tools';

import {
  BUDGET_QUERY,
  FAILED_RUNS_QUERY,
  PrometheusAgentRunStats,
  SPEND_QUERY,
} from './prometheus.agent-run-stats-adapter';

const NOW_MS = Date.UTC(2026, 10, 27, 12, 0, 0);

const metricsAnswering = (
  answers: Record<string, MetricSample[] | Error>,
): MetricsPort & { asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    instant: async (query: string) => {
      asked.push(query);
      const answer = answers[query] ?? [];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
};

const sample = (agent: string, value: number): MetricSample => ({ labels: { agent }, value });

describe('PrometheusAgentRunStats', () => {
  it('reads spend, failed runs and budget per agent', async () => {
    const metrics = metricsAnswering({
      [SPEND_QUERY]: [sample('happy', 0.42), sample('veronica', 0.1)],
      [FAILED_RUNS_QUERY]: [sample('dume', 2.9996)],
      [BUDGET_QUERY]: [sample('happy', 0.5), sample('dume', 1.5)],
    });

    const stats = await new PrometheusAgentRunStats(metrics).read(['happy', 'dume'], NOW_MS);

    expect([...stats]).toEqual([
      ['happy', { spentUsd: 0.42, failedRuns: 0, dayBudgetUsd: 0.5 }],
      ['dume', { spentUsd: 0, failedRuns: 3, dayBudgetUsd: 1.5 }],
    ]);
  });

  it('treats an agent with no series as having spent nothing and having no known budget', async () => {
    const stats = await new PrometheusAgentRunStats(metricsAnswering({})).read(['dume'], NOW_MS);

    expect(stats.get('dume')).toEqual({ spentUsd: 0, failedRuns: 0, dayBudgetUsd: null });
  });

  it('does not hide a failed query behind zeros', async () => {
    const metrics = metricsAnswering({ [SPEND_QUERY]: new Error('Grafana недоступна') });

    await expect(new PrometheusAgentRunStats(metrics).read(['happy'], NOW_MS)).rejects.toThrow(
      'Grafana недоступна',
    );
  });

  it('asks only for the failed outcomes that are failures of the run itself', () => {
    expect(FAILED_RUNS_QUERY).toContain('outcome=~"model_error|unexpected_error"');
    expect(SPEND_QUERY).toContain('app_ai_run_cost_USD_sum');
  });
});
