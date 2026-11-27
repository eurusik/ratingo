export const METRIC_OFFSET_MAX_DAYS = 14;
export const METRIC_DEFAULT_WINDOW = '24h';
export const METRIC_SERIES_CAP = 200;

export const METRICS_OUTPUT_CAP = 4500;

export const MetricTemplateName = {
  QUEUE_THROUGHPUT: 'queue_throughput',
  QUEUE_BACKLOG_PEAK: 'queue_backlog_peak',
  HTTP_CLIENT_ERRORS: 'http_client_errors',
  SITE_REQUESTS: 'site_requests',
  SITE_LATENCY_P95: 'site_latency_p95',
  SITE_MEMORY_PEAK: 'site_memory_peak',
  SCHEDULER_LAST_RUNS: 'scheduler_last_runs',
  BACKUP_STATUS: 'backup_status',
  INFRA_HEALTH: 'infra_health',
} as const;
export type MetricTemplateName = (typeof MetricTemplateName)[keyof typeof MetricTemplateName];
