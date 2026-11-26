export type JobSchedule = { cron: string } | { everyMs: number };

interface SystemCardJob {
  job: string;
  queue: string;
  schedule: JobSchedule;
  description: string;
}

interface SystemCardQueue {
  name: string;
  description: string;
}

interface SystemCardProvider {
  host: string;
  description: string;
}

export interface SystemCard {
  scheduledJobs: readonly SystemCardJob[];
  queues: readonly SystemCardQueue[];
  providers: readonly SystemCardProvider[];
}
