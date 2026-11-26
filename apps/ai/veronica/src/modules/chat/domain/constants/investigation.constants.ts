const HOURS_PER_DAY = 24;
const SECONDS_PER_DAY = HOURS_PER_DAY * 60 * 60;

export const CHAT_BUDGET_PER_MESSAGE_USD = 0.05;
export const CHAT_BUDGET_PER_DAY_USD = 0.3;
export const CHAT_MAX_TURNS = 8;
export const CHAT_BUDGET_WINDOW_MS = SECONDS_PER_DAY * 1000;

export const QUESTION_MAX_CHARS = 1000;
export const ANSWER_MAX_CHARS = 3500;

export const CONVERSATION_MAX_MESSAGES = 12;
export const CONVERSATION_TTL_SECONDS = SECONDS_PER_DAY;
export const CONVERSATION_MESSAGE_MAX_CHARS = 1000;

const METRIC_WINDOW_MAX_DAYS = 7;
export const METRIC_WINDOW_MAX_HOURS = METRIC_WINDOW_MAX_DAYS * HOURS_PER_DAY;
export const METRIC_OFFSET_MAX_DAYS = 14;
export const METRIC_DEFAULT_WINDOW = '24h';
export const METRIC_SERIES_CAP = 200;

export const METRICS_OUTPUT_CAP = 4500;
export const PRODUCT_OUTPUT_CAP = 3000;
export const SNAPSHOT_OUTPUT_CAP = 6000;
export const CHANGES_OUTPUT_CAP = 4000;
export const JOB_FAILURES_OUTPUT_CAP = 4500;
export const JOB_FAILURES_ROW_LIMIT = 100;

export const CHANGES_ITEM_CAP = 20;
export const CHANGE_TITLE_MAX_CHARS = 120;

export const InvestigationTool = {
  METRICS_QUERY: 'metrics_query',
  PRODUCT_STATS: 'product_stats',
  DIGEST_SNAPSHOT: 'digest_snapshot',
  RECENT_CHANGES: 'recent_changes',
  ASK_HAPPY: 'ask_happy',
  JOB_FAILURES: 'job_failures',
  LOGS_SEARCH: 'logs_search',
} as const;
export type InvestigationTool = (typeof InvestigationTool)[keyof typeof InvestigationTool];

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
