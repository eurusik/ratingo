import { Logger } from '@nestjs/common';
import type { ClockPort } from '@ratingo/ai-core';
import {
  GrafanaLokiLogsAdapter,
  JobFailuresExecutor,
  LogsSearchExecutor,
  MetricsQueryExecutor,
  PostgresJobFailuresAdapter,
  PrometheusMetricsAdapter,
  UnconfiguredJobFailuresAdapter,
  UnconfiguredLogsAdapter,
  type JobFailuresPort,
  type LogsPort,
  type OpsExecutors,
} from '@ratingo/ai-ops-tools';

import type { OpsConfig } from '../config/config.constants';

export interface OpsRuntime {
  executors: OpsExecutors;
  close(): Promise<void>;
}

const LOKI_VARIABLE_COUNT = 3;

const missingLokiVariables = ({ baseUrl, user, token }: OpsConfig['loki']): string[] => {
  const variables: readonly (readonly [string, string | undefined])[] = [
    ['GRAFANA_LOKI_URL', baseUrl],
    ['GRAFANA_LOKI_USER', user],
    ['GRAFANA_LOKI_TOKEN', token],
  ];
  return variables.filter(([, value]) => value === undefined).map(([name]) => name);
};

const logsPortFor = (loki: OpsConfig['loki'], logger: Logger): LogsPort => {
  const { baseUrl, user, token } = loki;
  if (baseUrl !== undefined && user !== undefined && token !== undefined) {
    return new GrafanaLokiLogsAdapter({ baseUrl, user, token });
  }
  const missing = missingLokiVariables(loki);
  if (missing.length < LOKI_VARIABLE_COUNT) {
    logger.warn(`logs_search is off, missing: ${missing.join(', ')}`);
  }
  return new UnconfiguredLogsAdapter();
};

export const createOpsRuntime = (config: OpsConfig, clock: ClockPort): OpsRuntime => {
  const logger = new Logger('OpsRuntime');
  const failures: JobFailuresPort & { close?(): Promise<void> } =
    config.readerDatabaseUrl === undefined
      ? new UnconfiguredJobFailuresAdapter()
      : PostgresJobFailuresAdapter.connect(config.readerDatabaseUrl);
  const logs = new LogsSearchExecutor(
    logsPortFor(config.loki, logger),
    clock,
    new Logger(LogsSearchExecutor.name),
  );
  const jobFailures = new JobFailuresExecutor(failures, clock);
  const metrics = new MetricsQueryExecutor(new PrometheusMetricsAdapter(config.prometheus), clock);
  return {
    executors: {
      logsSearch: (input) => logs.run(input),
      jobFailures: (input) => jobFailures.run(input),
      metricsQuery: (input) => metrics.run(input),
    },
    close: async () => {
      await failures.close?.();
    },
  };
};
