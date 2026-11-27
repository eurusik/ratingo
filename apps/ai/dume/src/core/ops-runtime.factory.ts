import { Logger } from '@nestjs/common';
import type { ClockPort } from '@ratingo/ai-core';
import {
  connectExplorer,
  DbQueryExecutor,
  DbSchemaExecutor,
  GrafanaLokiLogsAdapter,
  JobFailuresExecutor,
  LogsSearchExecutor,
  MetricsQueryExecutor,
  PostgresJobFailuresAdapter,
  PrometheusMetricsAdapter,
  UnconfiguredJobFailuresAdapter,
  UnconfiguredLogsAdapter,
  type ClosableExplorerPort,
  type JobFailuresPort,
  type LogsPort,
  type OpsExecutors,
} from '@ratingo/ai-ops-tools';

import type { OpsConfig } from '../config/config.constants';

export interface OpsRuntime {
  executors: OpsExecutors;
  close(): Promise<void>;
}

type LokiVariable = readonly [name: string, value: string | undefined];

const lokiVariables = ({ baseUrl, user, token }: OpsConfig['loki']): LokiVariable[] => [
  ['GRAFANA_LOKI_URL', baseUrl],
  ['GRAFANA_LOKI_USER', user],
  ['GRAFANA_LOKI_TOKEN', token],
];

const logsPortFor = (loki: OpsConfig['loki'], logger: Logger): LogsPort => {
  const { baseUrl, user, token } = loki;
  if (baseUrl !== undefined && user !== undefined && token !== undefined) {
    return new GrafanaLokiLogsAdapter({ baseUrl, user, token });
  }
  const variables = lokiVariables(loki);
  const missing = variables.filter(([, value]) => value === undefined).map(([name]) => name);
  if (missing.length < variables.length) {
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
  const explorer: ClosableExplorerPort = connectExplorer(config.explorerDatabaseUrl, logger);
  const dbSchema = new DbSchemaExecutor(explorer, new Logger(DbSchemaExecutor.name));
  const dbQuery = new DbQueryExecutor(explorer, new Logger(DbQueryExecutor.name));
  const logs = new LogsSearchExecutor(
    logsPortFor(config.loki, logger),
    clock,
    new Logger(LogsSearchExecutor.name),
  );
  const jobFailures = new JobFailuresExecutor(
    failures,
    clock,
    new Logger(JobFailuresExecutor.name),
  );
  const metrics = new MetricsQueryExecutor(
    new PrometheusMetricsAdapter(config.prometheus),
    clock,
    new Logger(MetricsQueryExecutor.name),
  );
  return {
    executors: {
      logsSearch: (input) => logs.run(input),
      jobFailures: (input) => jobFailures.run(input),
      metricsQuery: (input) => metrics.run(input),
      dbSchema: (input) => dbSchema.run(input),
      dbQuery: (input) => dbQuery.run(input),
    },
    close: async () => {
      await failures.close?.();
      await explorer.close?.();
    },
  };
};
