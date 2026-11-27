export { formatKyivDateTime } from './time/kyiv-time';
export { kyivDateOf } from './time/kyiv-day';

export {
  LOG_DEFAULT_LEVEL,
  LOG_DEFAULT_MODE,
  LOG_DEFAULT_WINDOW,
  LOG_FETCH_LIMIT_GROUPED,
  LOG_FETCH_LIMIT_LINES,
  LOG_SEARCH_OUTPUT_CAP,
  LogLevel,
  LogSearchMode,
  LogService,
  LogsFailureClass,
} from './logs/logs.constants';
export { GrafanaLokiLogsAdapter, type LokiConnection } from './logs/grafana-loki.logs-adapter';
export { UnconfiguredLogsAdapter } from './logs/unconfigured.logs-adapter';
export { LogsSearchExecutor } from './logs/logs-search.executor';
export type { OpsLogger } from './shared/ops-logger.port';
export {
  LogsUnavailableError,
  type LogQuery,
  type LogsFetch,
  type LogsPort,
  type RawLogLine,
} from './logs/logs.port';

export {
  JOB_FAILURES_OUTPUT_CAP,
  JOB_FAILURES_ROW_LIMIT,
} from './job-failures/job-failures.constants';
export { JobFailuresExecutor, nothingRecordedNote } from './job-failures/job-failures.executor';
export {
  JobFailuresUnavailableError,
  type JobFailureFilter,
  type JobFailureSummary,
  type JobFailuresPort,
} from './job-failures/job-failures.port';
export { PostgresJobFailuresAdapter } from './job-failures/postgres.job-failures-adapter';
export { UnconfiguredJobFailuresAdapter } from './job-failures/unconfigured.job-failures-adapter';
export { connectReportingDatabase } from './job-failures/reporting-connection';

export {
  METRICS_OUTPUT_CAP,
  METRIC_DEFAULT_WINDOW,
  METRIC_OFFSET_MAX_DAYS,
  METRIC_SERIES_CAP,
  MetricTemplateName,
} from './metrics/metrics.constants';
export type { JobSchedule } from './metrics/job-schedule';
export { METRIC_TEMPLATES } from './metrics/metric-templates';
export { MetricsQueryExecutor } from './metrics/metrics-query.executor';
export type { MetricSample, MetricsPort } from './metrics/metrics.port';
export * from './metrics/prom-queries';
export {
  MetricsQueryError,
  PrometheusMetricsAdapter,
  type PrometheusConnection,
} from './metrics/prometheus.metrics-adapter';
export { parseWindow } from './shared/metric-params.policy';
export { InvalidOpsInputError } from './shared/invalid-ops-input.error';
export {
  CUSTOM_CADENCE,
  describeCadence,
  scheduleFromLabel,
} from './metrics/schedule-cadence.policy';

export { jobFailuresInput, type JobFailuresInput } from './job-failures/job-failures.input';
export { logsSearchInput, type LogsSearchInput } from './logs/logs-search.input';
export { metricsQueryInput, type MetricsQueryInput } from './metrics/metrics-query.input';
export { OpsTool } from './tools/ops-tool-names';
export {
  createOpsTools,
  opsContentBudget,
  type OpsExecutors,
  type OpsOutputDecorator,
  type OpsTools,
  type OpsToolsOptions,
} from './tools/ops-tools';

export {
  createLokiSimulator,
  type LokiScenario,
  type SimulatedLogRecord,
} from './testing/loki.simulator';
export {
  createJobFailuresSimulator,
  type SimulatedJobFailureDay,
} from './testing/job-failures.simulator';
export { createPrometheusSimulator, type PrometheusAnswer } from './testing/prometheus.simulator';
