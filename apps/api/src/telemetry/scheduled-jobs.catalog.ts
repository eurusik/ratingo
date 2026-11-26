import { INGESTION_SCHEDULED_JOBS } from '../config/scheduler.config';
import { INGESTION_QUEUE, BACKFILL_QUEUE } from '../modules/ingestion/public';
import {
  KEY_HEALTH_CHECK_PATTERN,
  KEY_HEALTH_DESCRIPTION,
  KEY_HEALTH_SCHEDULER_ID,
  MONITORING_QUEUE,
} from '../modules/monitoring/public';
import {
  MOVIE_RELEASE_NOTIFICATIONS_DESCRIPTION,
  MOVIE_RELEASE_NOTIFICATIONS_PATTERN,
  MOVIE_RELEASE_NOTIFICATIONS_SCHEDULER_ID,
  USER_NOTIFICATIONS_QUEUE,
} from '../modules/user-actions/public';
import {
  LINK_PENDING_IMPORTS_DESCRIPTION,
  LINK_PENDING_IMPORTS_INTERVAL_MS,
  LINK_PENDING_IMPORTS_SCHEDULER_ID,
} from '../modules/user-media/public';

export type JobSchedule = { cron: string } | { everyMs: number };

export interface ScheduledJobEntry {
  jobId: string;
  queue: string;
  schedule: JobSchedule;
  description: string;
}

export const SCHEDULED_JOBS: readonly ScheduledJobEntry[] = [
  ...INGESTION_SCHEDULED_JOBS.map((job) => ({
    jobId: job.jobId,
    queue: INGESTION_QUEUE,
    schedule: { cron: job.pattern },
    description: job.description,
  })),
  {
    jobId: KEY_HEALTH_SCHEDULER_ID,
    queue: MONITORING_QUEUE,
    schedule: { cron: KEY_HEALTH_CHECK_PATTERN },
    description: KEY_HEALTH_DESCRIPTION,
  },
  {
    jobId: MOVIE_RELEASE_NOTIFICATIONS_SCHEDULER_ID,
    queue: USER_NOTIFICATIONS_QUEUE,
    schedule: { cron: MOVIE_RELEASE_NOTIFICATIONS_PATTERN },
    description: MOVIE_RELEASE_NOTIFICATIONS_DESCRIPTION,
  },
  {
    jobId: LINK_PENDING_IMPORTS_SCHEDULER_ID,
    queue: BACKFILL_QUEUE,
    schedule: { everyMs: LINK_PENDING_IMPORTS_INTERVAL_MS },
    description: LINK_PENDING_IMPORTS_DESCRIPTION,
  },
];
