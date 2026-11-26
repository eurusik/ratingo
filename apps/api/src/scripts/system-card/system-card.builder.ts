import { EXTERNAL_PROVIDERS } from '@/config/external-providers.catalog';
import { MONITORED_QUEUES } from '@/telemetry/monitored-queues.catalog';
import { SCHEDULED_JOBS, type JobSchedule } from '@/telemetry/scheduled-jobs.catalog';

export const SYSTEM_CARD_PATH =
  'apps/ai/veronica/src/modules/chat/domain/constants/system-card.json';

const JSON_INDENT = 2;

interface SystemCardData {
  scheduledJobs: { job: string; queue: string; schedule: JobSchedule; description: string }[];
  queues: { name: string; description: string }[];
  providers: { host: string; description: string }[];
}

const byKey =
  <T>(key: (item: T) => string) =>
  (a: T, b: T): number =>
    key(a).localeCompare(key(b));

export const buildSystemCard = (): SystemCardData => ({
  scheduledJobs: SCHEDULED_JOBS.map((job) => ({
    job: job.jobId,
    queue: job.queue,
    schedule: job.schedule,
    description: job.description,
  })).sort(byKey((job) => job.job)),
  queues: MONITORED_QUEUES.map((queue) => ({ ...queue })),
  providers: EXTERNAL_PROVIDERS.map((provider) => ({
    host: new URL(provider.apiUrl).hostname,
    description: provider.description,
  })),
});

export const renderSystemCardFile = (): string =>
  `${JSON.stringify(buildSystemCard(), null, JSON_INDENT)}\n`;
