export const METER_NAME = 'ratingo';
export const SHORT_COMMIT_SHA_LENGTH = 7;
export const METRICS_EXPORT_INTERVAL_MS = 60_000;
export const HEALTH_PATH_PREFIX = '/api/health';
export const UNMATCHED_ROUTE = 'unmatched';
export const HTTP_REQUEST_DURATION_METRIC = 'app.http.request.duration';
export const QUEUE_JOBS_METRIC = 'app.queue.jobs';
export const QUEUE_JOB_STATES = ['waiting', 'active', 'delayed', 'failed', 'prioritized'] as const;
export const SERVICE_NAME_BY_ROLE = {
  api: 'ratingo-api',
  worker: 'ratingo-worker',
  all: 'ratingo-api',
} as const;
