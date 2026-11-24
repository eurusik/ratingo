const BACKLOG_STATES = 'state=~"waiting|delayed|prioritized"';
const SERVICE = 'service_name="ratingo-storefront"';
const REQUEST_COUNT = 'app_next_request_duration_seconds_count';
const RENDER_BUCKET = 'app_next_render_duration_seconds_bucket';
const CLIENT_REQUESTS = 'http_client_request_duration_seconds_count';
const BOT_KINDS = 'bot|ai_crawler';
const ALL_KINDS = `human|${BOT_KINDS}`;
const ERROR_STATUSES = '401|403|429';

const DEFAULT_WINDOW = '24h';

const withLabels = (labels: readonly (string | null)[]): string =>
  labels.filter((label): label is string => label !== null).join(',');

const labelEquals = (name: string, value: string | undefined): string | null =>
  value === undefined ? null : `${name}="${value}"`;

export const queueBacklog = (queue?: string): string =>
  `sum by (queue) (app_queue_jobs{${withLabels([BACKLOG_STATES, labelEquals('queue', queue)])}})`;

export const queueBacklogPeak = (window: string = DEFAULT_WINDOW, queue?: string): string =>
  `max_over_time(${queueBacklog(queue)}[${window}:5m])`;

export const jobsByResult = (
  result: string,
  groupBy = 'queue',
  window: string = DEFAULT_WINDOW,
  queue?: string,
): string =>
  `sum by (${groupBy}) (increase(app_queue_job_duration_seconds_count{${withLabels([
    `result="${result}"`,
    labelEquals('queue', queue),
  ])}}[${window}]))`;

export const clientRequests = (window: string = DEFAULT_WINDOW): string =>
  `sum(increase(${CLIENT_REQUESTS}[${window}]))`;

export const clientErrors = (
  window: string = DEFAULT_WINDOW,
  filter: { provider?: string; status?: string } = {},
): string => {
  const status =
    filter.status === undefined
      ? `http_response_status_code=~"${ERROR_STATUSES}"`
      : `http_response_status_code="${filter.status}"`;
  return `sum by (server_address, http_response_status_code) (increase(${CLIENT_REQUESTS}{${withLabels(
    [labelEquals('server_address', filter.provider), status],
  )}}[${window}]))`;
};

export const siteRequests = (window: string = DEFAULT_WINDOW): string =>
  `sum(increase(${REQUEST_COUNT}{${SERVICE}}[${window}]))`;

export const siteServerErrors = (window: string = DEFAULT_WINDOW): string =>
  `sum(increase(${REQUEST_COUNT}{${SERVICE},http_response_status_code=~"5.."}[${window}]))`;

export const siteRenderP95 = (window: string = DEFAULT_WINDOW): string =>
  `histogram_quantile(0.95, sum by (le) (increase(${RENDER_BUCKET}{${SERVICE}}[${window}])))`;

export const sitePeakRss = (window: string = DEFAULT_WINDOW): string =>
  `max(max_over_time(app_process_memory_bytes{${SERVICE},type="rss"}[${window}]))`;

export const siteLoopDelayP99 = (window: string = DEFAULT_WINDOW): string =>
  `max(max_over_time(app_process_event_loop_delay_seconds{${SERVICE},percentile="p99"}[${window}]))`;

export const siteLabelledRequests = (window: string = DEFAULT_WINDOW): string =>
  `sum(increase(${REQUEST_COUNT}{${SERVICE},client_kind=~"${ALL_KINDS}"}[${window}]))`;

export const siteBotRequests = (window: string = DEFAULT_WINDOW): string =>
  `sum(increase(${REQUEST_COUNT}{${SERVICE},client_kind=~"${BOT_KINDS}"}[${window}]))`;

export const SCHEDULER_LAST_RUNS =
  'max by (job_name, result) (last_over_time(app_scheduler_last_run_timestamp_seconds[3d]))';

export const BACKUP_LAST_RUNS =
  'max by (result) (last_over_time(app_backup_last_run_timestamp_seconds[3d]))';
export const BACKUP_SIZE = 'max(last_over_time(app_backup_size_bytes[3d]))';

export const DATABASE_UP = 'min(last_over_time(pg_up[15m]))';
export const REDIS_UP = 'min(last_over_time(redis_up[15m]))';
export const REDIS_MEMORY_USED = 'max(last_over_time(redis_memory_used_bytes[15m]))';
export const REDIS_MEMORY_MAX = 'max(last_over_time(redis_memory_max_bytes[15m]))';
