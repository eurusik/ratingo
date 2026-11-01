export const METER_NAME = 'ratingo';
export const SHORT_COMMIT_SHA_LENGTH = 7;
export const METRICS_EXPORT_INTERVAL_MS = 60_000;
export const HEALTH_PATH_PREFIX = '/api/health';
export const UNMATCHED_ROUTE = 'unmatched';
export const HTTP_REQUEST_DURATION_METRIC = 'app.http.request.duration';
export const HTTP_DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
];
export const QUEUE_JOBS_METRIC = 'app.queue.jobs';
export const QUEUE_JOB_STATES = ['waiting', 'active', 'delayed', 'failed', 'prioritized'] as const;
export const QUEUE_JOB_DURATION_METRIC = 'app.queue.job.duration';
export const QUEUE_JOB_DURATION_BUCKETS_SECONDS = [
  0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600,
];
export const QUEUE_JOB_RESULT = {
  COMPLETED: 'completed',
  RETRIED: 'retried',
  FAILED: 'failed',
} as const;
export type QueueJobResult = (typeof QUEUE_JOB_RESULT)[keyof typeof QUEUE_JOB_RESULT];
export const EVENT_LOOP_DELAY_METRIC = 'app.process.event_loop.delay';
export const EVENT_LOOP_RESOLUTION_MS = 20;
export const EVENT_LOOP_PERCENTILES = [50, 99] as const;
export const PROCESS_MEMORY_METRIC = 'app.process.memory';
export const IMPORT_LINK_SWEEP_METRIC = 'app.import.link.sweep';
export const SERVICE_NAME_BY_ROLE = {
  api: 'ratingo-api',
  worker: 'ratingo-worker',
  all: 'ratingo-api',
} as const;
export const API_KEY_STATUS_METRIC = 'app.api_key.status';
export const API_KEY_PROBE_LATENCY_METRIC = 'app.api_key.probe.latency';
export const EXTERNAL_API_FAILURES_METRIC = 'app.external_api.failures';
