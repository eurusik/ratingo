import { FixedClock, NativeToolSource, ToolRegistry } from '@ratingo/ai-core';

import type { MetricSample } from '../../../digest/public';
import {
  InvestigationTool,
  METRICS_OUTPUT_CAP,
  MetricTemplateName,
} from '../../domain/constants/investigation.constants';
import { SYSTEM_CARD } from '../../domain/constants/system-card.constants';

import type { InvestigationExecutors } from './investigation-executors';
import { buildInvestigationTools } from './investigation-tools';
import { METRIC_TEMPLATES } from './metric-templates';
import { MetricsQueryExecutor } from './metrics-query.executor';

const NOW_MS = Date.UTC(2026, 10, 26, 12, 13);
const NOW_SECONDS = NOW_MS / 1000;
const HOUR_SECONDS = 3600;
const ERROR_STATUSES = ['401', '403', '429'];
const MS_PER_SECOND = 1000;

const scheduleLabel = (schedule: (typeof SYSTEM_CARD.scheduledJobs)[number]['schedule']): string =>
  'cron' in schedule ? schedule.cron : `every ${schedule.everyMs / MS_PER_SECOND}s`;

const queues = SYSTEM_CARD.queues.map((queue) => queue.name);
const jobs = SYSTEM_CARD.scheduledJobs;

const perQueue = (value: number): MetricSample[] =>
  queues.map((queue) => ({ labels: { queue }, value }));

const FULL_SAMPLES: Readonly<Record<string, MetricSample[]>> = {
  completed: perQueue(123_456),
  failed: perQueue(1234),
  retried: perQueue(123),
  now: perQueue(98_765),
  peak: perQueue(98_765),
  total: [{ labels: {}, value: 1_234_567 }],
  errors: SYSTEM_CARD.providers.flatMap((provider) =>
    ERROR_STATUSES.map((status) => ({
      labels: { server_address: provider.host, http_response_status_code: status },
      value: 4321,
    })),
  ),
  requests: [{ labels: {}, value: 1_234_567 }],
  serverErrors: [{ labels: {}, value: 1234 }],
  p95: [{ labels: {}, value: 1.234 }],
  rss: [{ labels: {}, value: 512 * 1024 * 1024 }],
  runs: jobs.flatMap((job) => [
    { labels: { job_name: job.job, result: 'success' }, value: NOW_SECONDS - 77.22 * HOUR_SECONDS },
    { labels: { job_name: job.job, result: 'failure' }, value: NOW_SECONDS - 12.34 * HOUR_SECONDS },
  ]),
  next: jobs.map((job) => ({
    labels: { job_name: job.job, schedule: scheduleLabel(job.schedule), tz: 'UTC' },
    value: NOW_SECONDS + 90.78 * HOUR_SECONDS,
  })),
  size: [{ labels: {}, value: 512 * 1024 * 1024 }],
  database: [{ labels: {}, value: 1 }],
  redis: [{ labels: {}, value: 1 }],
  redisMemory: [{ labels: {}, value: 9.5 * 1024 * 1024 }],
};

const samplesByQuery = (): Map<string, MetricSample[]> => {
  const byQuery = new Map<string, MetricSample[]>();
  for (const template of Object.values(METRIC_TEMPLATES)) {
    const params = template.params.parse({});
    for (const query of template.queries(params)) {
      byQuery.set(query.promql, FULL_SAMPLES[query.name] ?? []);
    }
  }
  return byQuery;
};

const metricsTool = async (): Promise<ToolRegistry> => {
  const byQuery = samplesByQuery();
  const executor = new MetricsQueryExecutor(
    { instant: async (query) => byQuery.get(query) ?? [] },
    new FixedClock(NOW_MS),
  );
  const tools = buildInvestigationTools({
    metricsQuery: (input) => executor.run(input),
  } as InvestigationExecutors);
  return ToolRegistry.create([new NativeToolSource(tools)], [InvestigationTool.METRICS_QUERY]);
};

const runTemplate = async (template: MetricTemplateName, extra: Record<string, unknown> = {}) => {
  const registry = await metricsTool();
  const result = await registry.execute(
    { id: 'call-1', name: InvestigationTool.METRICS_QUERY, input: { template, ...extra } },
    { runId: 'run-1' },
  );
  return result.content;
};

const omittedOf = (value: unknown): { omitted: number; hint: unknown } | null => {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.omitted === 'number') return { omitted: record.omitted, hint: record.hint };
  return omittedOf(record.data);
};

describe('metrics_query output at the real size of Ratingo', () => {
  it.each(Object.values(MetricTemplateName))(
    '%s returns whole JSON within the cap, with any left-out rows named',
    async (template) => {
      const content = await runTemplate(template);

      expect(content.length).toBeLessThanOrEqual(METRICS_OUTPUT_CAP);
      const parsed: unknown = JSON.parse(content);
      const omission = omittedOf(parsed);
      if (omission !== null) {
        expect(omission.omitted).toBeGreaterThan(0);
        expect(omission.hint).toEqual(expect.stringContaining('pass '));
      }
    },
  );

  it('lists every scheduled job with its next run, the late-alphabet ones included', async () => {
    const parsed = JSON.parse(await runTemplate(MetricTemplateName.SCHEDULER_LAST_RUNS)) as {
      data: { jobs: { job: string; nextRunAtKyiv?: string }[]; omitted?: number };
    };

    expect(parsed.data.omitted).toBeUndefined();
    expect(parsed.data.jobs.map((row) => row.job)).toEqual(jobs.map((job) => job.job));
    expect(parsed.data.jobs.every((row) => row.nextRunAtKyiv !== undefined)).toBe(true);
  });

  it('lists every queue and every provider error without leaving any out', async () => {
    for (const template of [
      MetricTemplateName.QUEUE_THROUGHPUT,
      MetricTemplateName.QUEUE_BACKLOG_PEAK,
      MetricTemplateName.HTTP_CLIENT_ERRORS,
    ]) {
      expect(omittedOf(JSON.parse(await runTemplate(template)))).toBeNull();
    }
  });

  it('narrows the scheduler list to one job by part of its name', async () => {
    const parsed = JSON.parse(
      await runTemplate(MetricTemplateName.SCHEDULER_LAST_RUNS, { job: 'refresh-all' }),
    ) as { data: { jobs: { job: string; cadence: string }[] } };

    expect(parsed.data.jobs).toEqual([
      expect.objectContaining({
        job: 'scheduled-upcoming-movies-refresh-all',
        cadence: 'weekly on Monday',
      }),
    ]);
  });
});
