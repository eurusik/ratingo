import { FixedClock } from '@ratingo/ai-core';
import {
  GrafanaLokiLogsAdapter,
  JobFailuresExecutor,
  LogsSearchExecutor,
  MetricsQueryExecutor,
  OpsTool,
  PrometheusMetricsAdapter,
  UnconfiguredJobFailuresAdapter,
  UnconfiguredLogsAdapter,
  createJobFailuresSimulator,
  createLokiSimulator,
  createPrometheusSimulator,
  type OpsExecutors,
} from '@ratingo/ai-ops-tools';

import type { RuntimeFixture } from './eval-case';
import { EVAL_NOW_MS } from './eval-clock';

const SILENT_LOGGER = { warn: () => undefined };
const SIMULATED_LOKI = { baseUrl: 'https://loki.eval.invalid', user: '1', token: 'eval' };
const SIMULATED_PROMETHEUS = { baseUrl: 'https://prometheus.eval.invalid', token: 'eval' };
const NOTHING_SIMULATED: RuntimeFixture = { unavailable: Object.values(OpsTool) };

export const opsForFixture = (fixture: RuntimeFixture = NOTHING_SIMULATED): OpsExecutors => {
  const clock = new FixedClock(EVAL_NOW_MS);
  const unavailable = new Set(fixture.unavailable ?? []);
  const logs = new LogsSearchExecutor(
    unavailable.has(OpsTool.LOGS_SEARCH)
      ? new UnconfiguredLogsAdapter()
      : new GrafanaLokiLogsAdapter(
          SIMULATED_LOKI,
          createLokiSimulator(EVAL_NOW_MS)(fixture.logs ?? { records: [] }),
        ),
    clock,
    SILENT_LOGGER,
  );
  const failures = new JobFailuresExecutor(
    unavailable.has(OpsTool.JOB_FAILURES)
      ? new UnconfiguredJobFailuresAdapter()
      : createJobFailuresSimulator(fixture.failures ?? []),
    clock,
    SILENT_LOGGER,
  );
  const metrics = new MetricsQueryExecutor(
    unavailable.has(OpsTool.METRICS_QUERY)
      ? new PrometheusMetricsAdapter({})
      : new PrometheusMetricsAdapter(
          SIMULATED_PROMETHEUS,
          createPrometheusSimulator(fixture.metrics ?? [], EVAL_NOW_MS),
        ),
    clock,
    SILENT_LOGGER,
  );
  return {
    logsSearch: (input) => logs.run(input),
    jobFailures: (input) => failures.run(input),
    metricsQuery: (input) => metrics.run(input),
  };
};
