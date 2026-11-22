import { z } from 'zod';

import { PromQueries } from '../../../digest/public';
import {
  METRIC_DEFAULT_WINDOW,
  METRIC_OFFSET_MAX_DAYS,
  MetricTemplateName,
} from '../../domain/constants/investigation.constants';
import {
  isHttpStatus,
  isProviderName,
  isQueueName,
  parseWindow,
} from '../../domain/policies/metric-params.policy';

const MS_PER_HOUR = 3_600_000;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const MS_PER_SECOND = 1000;
const ROUND_FACTOR = 100;

interface NamedQuery {
  name: string;
  promql: string;
}

export interface QueryResult {
  name: string;
  samples: readonly { labels: Readonly<Record<string, string>>; value: number }[];
}

type TemplateReading = { unavailable: string } | { data: unknown };

export interface MetricTemplate {
  name: MetricTemplateName;
  description: string;
  params: z.ZodType<Record<string, unknown>>;
  queries(params: Record<string, unknown>): NamedQuery[];
  present(results: readonly QueryResult[], nowMs: number): TemplateReading;
}

const windowField = z
  .string()
  .refine((value) => parseWindow(value) !== null, {
    message: 'window must look like 6h, 24h or 7d and be at most 7 days',
  })
  .default(METRIC_DEFAULT_WINDOW);
const offsetField = z.number().int().min(0).max(METRIC_OFFSET_MAX_DAYS).default(0);
const queueField = z.string().refine(isQueueName, { message: 'invalid queue name' }).optional();
const providerField = z
  .string()
  .refine(isProviderName, { message: 'invalid provider host name' })
  .optional();
const statusField = z
  .string()
  .refine(isHttpStatus, { message: 'status must be 3 digits' })
  .optional();

const windowed = { window: windowField, offset_days: offsetField };

const promWindow = (params: Record<string, unknown>): string =>
  parseWindow(String(params.window))?.promql ?? METRIC_DEFAULT_WINDOW;

const round = (value: number): number => Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
const hoursAgo = (epochSeconds: number, nowMs: number): number =>
  round(Math.max(0, (nowMs - epochSeconds * MS_PER_SECOND) / MS_PER_HOUR));

const firstValue = (results: readonly QueryResult[], name: string): number | null =>
  results.find((result) => result.name === name)?.samples[0]?.value ?? null;

const byLabel = (
  results: readonly QueryResult[],
  name: string,
  label: string,
): Map<string, number> =>
  new Map(
    (results.find((result) => result.name === name)?.samples ?? []).map((sample) => [
      sample.labels[label] ?? '',
      sample.value,
    ]),
  );

const NO_DATA = 'метрик за цей запит немає';

const queueThroughput: MetricTemplate = {
  name: MetricTemplateName.QUEUE_THROUGHPUT,
  description: 'Completed, failed and retried jobs per queue within the window.',
  params: z.strictObject({ queue: queueField, ...windowed }),
  queries: (params) => {
    const window = promWindow(params);
    const queue = params.queue as string | undefined;
    return ['completed', 'failed', 'retried'].map((result) => ({
      name: result,
      promql: PromQueries.jobsByResult(result, 'queue', window, queue),
    }));
  },
  present: (results) => {
    const completed = byLabel(results, 'completed', 'queue');
    if (completed.size === 0) return { unavailable: NO_DATA };
    const failed = byLabel(results, 'failed', 'queue');
    const retried = byLabel(results, 'retried', 'queue');
    return {
      data: [...completed.keys()].sort().map((queue) => ({
        queue,
        completed: Math.round(completed.get(queue) ?? 0),
        failed: Math.round(failed.get(queue) ?? 0),
        retried: Math.round(retried.get(queue) ?? 0),
      })),
    };
  },
};

const queueBacklogPeak: MetricTemplate = {
  name: MetricTemplateName.QUEUE_BACKLOG_PEAK,
  description: 'Jobs waiting now and the highest backlog within the window, per queue.',
  params: z.strictObject({ queue: queueField, ...windowed }),
  queries: (params) => {
    const queue = params.queue as string | undefined;
    return [
      { name: 'now', promql: PromQueries.queueBacklog(queue) },
      { name: 'peak', promql: PromQueries.queueBacklogPeak(promWindow(params), queue) },
    ];
  },
  present: (results) => {
    const peak = byLabel(results, 'peak', 'queue');
    if (peak.size === 0) return { unavailable: NO_DATA };
    const now = byLabel(results, 'now', 'queue');
    return {
      data: [...peak.keys()].sort().map((queue) => ({
        queue,
        waitingNow: now.has(queue) ? Math.round(now.get(queue) ?? 0) : null,
        peakInWindow: Math.round(peak.get(queue) ?? 0),
      })),
    };
  },
};

const httpClientErrors: MetricTemplate = {
  name: MetricTemplateName.HTTP_CLIENT_ERRORS,
  description:
    'Outgoing HTTP errors (401, 403, 429 by default, or one status) per provider host within the window.',
  params: z.strictObject({ provider: providerField, status: statusField, ...windowed }),
  queries: (params) => {
    const window = promWindow(params);
    return [
      { name: 'total', promql: PromQueries.clientRequests(window) },
      {
        name: 'errors',
        promql: PromQueries.clientErrors(window, {
          provider: params.provider as string | undefined,
          status: params.status as string | undefined,
        }),
      },
    ];
  },
  present: (results) => {
    const total = firstValue(results, 'total');
    if (total === null) return { unavailable: NO_DATA };
    const errors = results.find((result) => result.name === 'errors')?.samples ?? [];
    return {
      data: {
        totalOutgoingRequests: Math.round(total),
        errors: errors
          .filter((sample) => sample.value > 0)
          .map((sample) => ({
            provider: sample.labels.server_address ?? 'невідомий',
            status: sample.labels.http_response_status_code ?? 'невідомий',
            count: Math.round(sample.value),
          })),
      },
    };
  },
};

const siteRequests: MetricTemplate = {
  name: MetricTemplateName.SITE_REQUESTS,
  description: 'Storefront requests and server errors (5xx) within the window.',
  params: z.strictObject(windowed),
  queries: (params) => [
    { name: 'requests', promql: PromQueries.siteRequests(promWindow(params)) },
    { name: 'serverErrors', promql: PromQueries.siteServerErrors(promWindow(params)) },
  ],
  present: (results) => {
    const requests = firstValue(results, 'requests');
    if (requests === null) return { unavailable: NO_DATA };
    return {
      data: {
        requests: Math.round(requests),
        serverErrors: Math.round(firstValue(results, 'serverErrors') ?? 0),
      },
    };
  },
};

const siteLatencyP95: MetricTemplate = {
  name: MetricTemplateName.SITE_LATENCY_P95,
  description: 'Storefront page render time, 95th percentile, in milliseconds.',
  params: z.strictObject(windowed),
  queries: (params) => [{ name: 'p95', promql: PromQueries.siteRenderP95(promWindow(params)) }],
  present: (results) => {
    const p95 = firstValue(results, 'p95');
    return p95 === null
      ? { unavailable: NO_DATA }
      : { data: { p95Ms: Math.round(p95 * MS_PER_SECOND) } };
  },
};

const siteMemoryPeak: MetricTemplate = {
  name: MetricTemplateName.SITE_MEMORY_PEAK,
  description: 'Highest storefront process memory (RSS) within the window, in megabytes.',
  params: z.strictObject(windowed),
  queries: (params) => [{ name: 'rss', promql: PromQueries.sitePeakRss(promWindow(params)) }],
  present: (results) => {
    const rss = firstValue(results, 'rss');
    return rss === null
      ? { unavailable: NO_DATA }
      : { data: { peakMemoryMb: Math.round(rss / BYTES_PER_MEGABYTE) } };
  },
};

const schedulerLastRuns: MetricTemplate = {
  name: MetricTemplateName.SCHEDULER_LAST_RUNS,
  description: 'Hours since each scheduled job last succeeded or failed.',
  params: z.strictObject({}),
  queries: () => [{ name: 'runs', promql: PromQueries.SCHEDULER_LAST_RUNS }],
  present: (results, nowMs) => {
    const runs = results.find((result) => result.name === 'runs')?.samples ?? [];
    if (runs.length === 0) return { unavailable: NO_DATA };
    return {
      data: runs
        .map((sample) => ({
          job: sample.labels.job_name ?? 'невідоме',
          result: sample.labels.result ?? 'невідомий',
          hoursAgo: hoursAgo(sample.value, nowMs),
        }))
        .sort((a, b) => a.job.localeCompare(b.job) || a.result.localeCompare(b.result)),
    };
  },
};

const backupStatus: MetricTemplate = {
  name: MetricTemplateName.BACKUP_STATUS,
  description: 'Hours since the last database backup, its result and its size in megabytes.',
  params: z.strictObject({}),
  queries: () => [
    { name: 'runs', promql: PromQueries.BACKUP_LAST_RUNS },
    { name: 'size', promql: PromQueries.BACKUP_SIZE },
  ],
  present: (results, nowMs) => {
    const runs = results.find((result) => result.name === 'runs')?.samples ?? [];
    const latest = [...runs].sort((a, b) => b.value - a.value)[0];
    if (latest === undefined) return { unavailable: NO_DATA };
    const size = firstValue(results, 'size');
    return {
      data: {
        lastResult: latest.labels.result ?? 'невідомий',
        hoursAgo: hoursAgo(latest.value, nowMs),
        sizeMb: size === null ? null : Math.round(size / BYTES_PER_MEGABYTE),
      },
    };
  },
};

const infraHealth: MetricTemplate = {
  name: MetricTemplateName.INFRA_HEALTH,
  description: 'Whether PostgreSQL and Redis are up, and Redis memory in megabytes.',
  params: z.strictObject({}),
  queries: () => [
    { name: 'database', promql: PromQueries.DATABASE_UP },
    { name: 'redis', promql: PromQueries.REDIS_UP },
    { name: 'redisMemory', promql: PromQueries.REDIS_MEMORY_USED },
  ],
  present: (results) => {
    const database = firstValue(results, 'database');
    const redis = firstValue(results, 'redis');
    if (database === null || redis === null) return { unavailable: NO_DATA };
    const memory = firstValue(results, 'redisMemory');
    return {
      data: {
        databaseUp: database >= 1,
        redisUp: redis >= 1,
        redisMemoryMb: memory === null ? null : round(memory / BYTES_PER_MEGABYTE),
      },
    };
  },
};

export const METRIC_TEMPLATES: Readonly<Record<MetricTemplateName, MetricTemplate>> = {
  [MetricTemplateName.QUEUE_THROUGHPUT]: queueThroughput,
  [MetricTemplateName.QUEUE_BACKLOG_PEAK]: queueBacklogPeak,
  [MetricTemplateName.HTTP_CLIENT_ERRORS]: httpClientErrors,
  [MetricTemplateName.SITE_REQUESTS]: siteRequests,
  [MetricTemplateName.SITE_LATENCY_P95]: siteLatencyP95,
  [MetricTemplateName.SITE_MEMORY_PEAK]: siteMemoryPeak,
  [MetricTemplateName.SCHEDULER_LAST_RUNS]: schedulerLastRuns,
  [MetricTemplateName.BACKUP_STATUS]: backupStatus,
  [MetricTemplateName.INFRA_HEALTH]: infraHealth,
};
