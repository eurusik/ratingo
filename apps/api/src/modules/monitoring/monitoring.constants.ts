export const MONITORING_QUEUE = 'monitoring-queue';

export const MONITORING_JOBS = {
  CHECK_KEYS: 'check-keys',
} as const;

export type MonitoringJob = (typeof MONITORING_JOBS)[keyof typeof MONITORING_JOBS];

export const KEY_HEALTH_SCHEDULER_ID = 'scheduled-key-health';

export const KEY_HEALTH_CHECK_PATTERN = '*/20 * * * *';

export const KEY_HEALTH_HISTORY_LIMIT = 50;
