import { FixedClock, NativeToolSource, ToolRegistry } from '@ratingo/ai-core';
import {
  DbQueryExecutor,
  DbSchemaExecutor,
  ExplorerFailureError,
  ExplorerNotConfiguredError,
  ExplorerQueryRefusedError,
  GrafanaLokiLogsAdapter,
  JobFailuresExecutor,
  JobFailuresUnavailableError,
  LogsSearchExecutor,
  METRIC_TEMPLATES,
  MetricTemplateName,
  MetricsQueryExecutor,
  PrometheusMetricsAdapter,
  QueryRefusal,
  UnconfiguredJobFailuresAdapter,
  UnconfiguredLogsAdapter,
  type ExplorerPort,
  type JobFailureSummary,
  type LogsFetch,
  type MetricSample,
  type QueryRows,
  type RawLogLine,
  type SchemaListing,
} from '@ratingo/ai-ops-tools';

import { SYSTEM_CARD, SYSTEM_CARD_MAX_CHARS } from '../../domain/constants/system-card.constants';
import type { SystemCard } from '../../domain/entities/system-card';
import { renderSystemCard } from '../../domain/policies/system-card.policy';

import type { InvestigationExecutors } from './investigation-executors';
import { buildInvestigationTools } from './investigation-tools';
import { NO_DELEGATION } from './no-delegation.testing';

const QUIET = { warn: () => undefined };
const NOW_MS = Date.UTC(2026, 10, 26, 12, 0, 0);
const MINUTE_MS = 60_000;
const HOUR_SECONDS = 3600;
const NOW_SECONDS = NOW_MS / 1000;
const MEGABYTE = 1024 * 1024;

const logRecord = (minutesAgo: number, fields: Record<string, unknown> = {}): RawLogLine => ({
  atMs: NOW_MS - minutesAgo * MINUTE_MS,
  line: JSON.stringify({
    level: 'error',
    context: 'SyncShow',
    message: 'Job failed',
    ...fields,
  }),
});

const SECRET_LINE = logRecord(7, {
  context: 'TmdbClient',
  message: 'Request failed Authorization: Bearer abcdef1234567890abcdef1234567890',
  error_name: 'HttpError',
  error_message: 'TMDB API: Request timeout api_key=0123456789abcdef0123456789abcdef',
  error_stack:
    'HttpError: TMDB API: Request timeout\n    at TmdbClient.get (tmdb.client.ts:88:11)\n    at SyncMediaService.syncShow (sync-media.service.ts:156:7)\n    at Worker.process (worker.ts:12:3)\n    at extra.frame (extra.ts:1:1)',
  job_id: 'sync-show:3100',
  queue: 'ingestion',
});

const REPEATED_LINES: RawLogLine[] = [
  SECRET_LINE,
  logRecord(20, { message: 'Failed to sync tracked show 4021: timeout', context: 'TrackedShows' }),
  logRecord(25, { message: 'Failed to sync tracked show 4022: timeout', context: 'TrackedShows' }),
  logRecord(30, { message: 'Failed to sync tracked show 4023: timeout', context: 'TrackedShows' }),
  logRecord(95, { message: 'Queue stalled', context: 'Worker', repeats: 4, queue: 'stats-queue' }),
];

const MANY_LINES: RawLogLine[] = Array.from({ length: 80 }, (_, index) =>
  logRecord(index + 1, {
    message: `Distinct failure number ${index} ${'x'.repeat(40)}${'abc'.repeat(index)}`,
    context: `Context${index}`,
  }),
);

const logsFor = (fetch: LogsFetch | Error) =>
  new LogsSearchExecutor(
    {
      search: async () => {
        if (fetch instanceof Error) throw fetch;
        return fetch;
      },
    },
    new FixedClock(NOW_MS),
    QUIET,
  );

const summary = (overrides: Partial<JobFailureSummary> = {}): JobFailureSummary => ({
  job: 'scheduled-trending',
  jobType: 'sync-trending-dispatcher',
  queue: 'ingestion',
  errorClass: 'rate_limit',
  failures: 12,
  attemptsExhausted: 3,
  firstFailedAtMs: Date.UTC(2026, 10, 26, 6, 0),
  lastFailedAtMs: Date.UTC(2026, 10, 26, 10, 15),
  lastMessage: 'Trakt API: 429 Too Many Requests',
  ...overrides,
});

const FAILURE_ROWS: JobFailureSummary[] = [
  summary({ job: 'sync-show', jobType: 'sync-show', failures: 2, errorClass: 'not_found' }),
  summary(),
  summary({
    job: 'scheduled-stats',
    jobType: 'sync-stats',
    queue: 'stats-queue',
    errorClass: 'timeout',
    failures: 40,
    lastMessage: 'connect ETIMEDOUT token=glc_abcdefghijklmnopqrstuvwxyz0123456789',
  }),
];

const MANY_FAILURES: JobFailureSummary[] = Array.from({ length: 60 }, (_, index) =>
  summary({
    job: `scheduled-job-${index}`,
    failures: 100 - index,
    lastMessage: `Provider answered with a long message ${'y'.repeat(120)}`,
  }),
);

const failuresFor = (rows: JobFailureSummary[] | Error) =>
  new JobFailuresExecutor(
    {
      since: async () => {
        if (rows instanceof Error) throw rows;
        return rows;
      },
    },
    new FixedClock(NOW_MS),
    QUIET,
  );

const FIXTURE_CARD: SystemCard = {
  scheduledJobs: [
    {
      job: 'job-every-two-minutes',
      queue: 'ingestion',
      schedule: { everyMs: 120_000 },
      description: 'runs often',
    },
    {
      job: 'job-every-twenty-minutes',
      queue: 'ingestion',
      schedule: { cron: '*/20 * * * *' },
      description: 'runs every twenty minutes',
    },
    {
      job: 'job-every-four-hours',
      queue: 'ingestion',
      schedule: { cron: '0 */4 * * *' },
      description: 'runs every four hours',
    },
    {
      job: 'job-twice-a-day',
      queue: 'stats-queue',
      schedule: { cron: '0 8,20 * * *' },
      description: 'runs twice a day',
    },
    {
      job: 'job-daily',
      queue: 'stats-queue',
      schedule: { cron: '0 3 * * *' },
      description: 'runs once a day',
    },
    {
      job: 'job-daily-except-monday',
      queue: 'stats-queue',
      schedule: { cron: '0 7 * * 0,2-6' },
      description: 'skips Monday',
    },
    {
      job: 'job-weekly',
      queue: 'ingestion',
      schedule: { cron: '0 7 * * 1' },
      description: 'runs weekly',
    },
    {
      job: 'job-weekly-on-sunday',
      queue: 'ingestion',
      schedule: { cron: '0 4 * * 0' },
      description: 'runs on Sunday',
    },
    {
      job: 'job-three-days-a-week',
      queue: 'ingestion',
      schedule: { cron: '0 9 * * 1,3,5' },
      description: 'runs on three days',
    },
    {
      job: 'job-twice-on-saturday',
      queue: 'stats-queue',
      schedule: { cron: '0 9,21 * * 6' },
      description: 'runs twice on Saturday',
    },
    {
      job: 'job-monthly',
      queue: 'stats-queue',
      schedule: { cron: '0 9 1 * *' },
      description: 'runs monthly',
    },
  ],
  queues: [
    { name: 'ingestion', description: 'syncs titles' },
    { name: 'stats-queue', description: 'computes statistics' },
  ],
  providers: [
    { host: 'api.themoviedb.org', description: 'titles and images' },
    { host: 'api.trakt.tv', description: 'trending and ratings' },
    { host: 'api.tvmaze.com', description: 'episode data' },
  ],
};

const scheduleLabel = (
  schedule: (typeof FIXTURE_CARD.scheduledJobs)[number]['schedule'],
): string => ('cron' in schedule ? schedule.cron : `every ${schedule.everyMs / 1000}s`);

const queueNames = FIXTURE_CARD.queues.map((queue) => queue.name);
const perQueue = (value: number): MetricSample[] =>
  queueNames.map((queue) => ({ labels: { queue }, value }));

const METRIC_SAMPLES: Readonly<Record<string, MetricSample[]>> = {
  completed: perQueue(123_456),
  failed: perQueue(1234),
  retried: perQueue(123),
  now: perQueue(98_765),
  peak: perQueue(98_765),
  total: [{ labels: {}, value: 1_234_567 }],
  errors: FIXTURE_CARD.providers.flatMap((provider) =>
    ['401', '403', '429'].map((status) => ({
      labels: { server_address: provider.host, http_response_status_code: status },
      value: 4321,
    })),
  ),
  requests: [{ labels: {}, value: 1_234_567 }],
  serverErrors: [{ labels: {}, value: 1234 }],
  p95: [{ labels: {}, value: 1.234 }],
  rss: [{ labels: {}, value: 512 * MEGABYTE }],
  runs: FIXTURE_CARD.scheduledJobs.flatMap((job) => [
    { labels: { job_name: job.job, result: 'success' }, value: NOW_SECONDS - 77.22 * HOUR_SECONDS },
    { labels: { job_name: job.job, result: 'failure' }, value: NOW_SECONDS - 12.34 * HOUR_SECONDS },
  ]),
  next: FIXTURE_CARD.scheduledJobs.map((job) => ({
    labels: { job_name: job.job, schedule: scheduleLabel(job.schedule), tz: 'UTC' },
    value: NOW_SECONDS + 90.78 * HOUR_SECONDS,
  })),
  size: [{ labels: {}, value: 512 * MEGABYTE }],
  database: [{ labels: {}, value: 1 }],
  redis: [{ labels: {}, value: 1 }],
  redisMemory: [{ labels: {}, value: 9.5 * MEGABYTE }],
};

const samplesByQuery = (): Map<string, MetricSample[]> => {
  const byQuery = new Map<string, MetricSample[]>();
  for (const template of Object.values(METRIC_TEMPLATES)) {
    for (const query of template.queries(template.params.parse({}))) {
      byQuery.set(query.promql, METRIC_SAMPLES[query.name] ?? []);
    }
  }
  return byQuery;
};

const metricsFor = (answer: 'full' | 'none' | Error) => {
  const byQuery = samplesByQuery();
  return new MetricsQueryExecutor(
    {
      instant: async (query) => {
        if (answer instanceof Error) throw answer;
        return answer === 'none' ? [] : (byQuery.get(query) ?? []);
      },
    },
    new FixedClock(NOW_MS),
    QUIET,
  );
};

const SCHEMA_LISTING: SchemaListing = {
  tables: [
    {
      name: 'users',
      kind: 'table',
      rowEstimate: 1234,
      columns: [
        { name: 'id', type: 'uuid' },
        { name: 'role', type: 'user_role', enumValues: ['user', 'admin'] },
        { name: 'created_at', type: 'timestamp without time zone' },
      ],
      privateColumnCount: 7,
    },
    {
      name: 'user_saved_items',
      kind: 'table',
      rowEstimate: 4321,
      columns: [
        { name: 'user_id', type: 'uuid' },
        { name: 'media_item_id', type: 'uuid' },
        { name: 'list', type: 'saved_item_list', enumValues: ['for_later', 'considering'] },
      ],
      privateColumnCount: 0,
    },
    {
      name: 'public_media_items',
      kind: 'view',
      rowEstimate: null,
      columns: [{ name: 'title', type: 'text' }],
      privateColumnCount: 0,
    },
  ],
  privateTables: ['oauth_accounts', 'refresh_tokens'],
};

const QUERY_ROWS: QueryRows = {
  columns: ['title', 'saves'],
  rows: [
    { title: 'Alpha Show', saves: 3 },
    { title: 'Zeta Movie', saves: 2 },
  ],
  hasMoreRows: false,
};

const MANY_QUERY_ROWS: QueryRows = {
  columns: ['n', 'text'],
  rows: Array.from({ length: 100 }, (_unused, index) => ({ n: index, text: 'z'.repeat(60) })),
  hasMoreRows: true,
};

const explorerAnswering = (answer: QueryRows | Error): ExplorerPort => ({
  schema: async () => {
    if (answer instanceof Error) throw answer;
    return SCHEMA_LISTING;
  },
  query: async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  },
});

const explorerExecutorsFor = (answer: QueryRows | Error) => ({
  schema: new DbSchemaExecutor(explorerAnswering(answer), QUIET),
  query: new DbQueryExecutor(explorerAnswering(answer), QUIET),
});

interface Executors {
  logs: LogsSearchExecutor;
  failures: JobFailuresExecutor;
  metrics: MetricsQueryExecutor;
  database: ReturnType<typeof explorerExecutorsFor>;
}

const registryFor = ({ logs, failures, metrics, database }: Executors): Promise<ToolRegistry> => {
  const executors = {
    metricsQuery: (input) => metrics.run(input),
    jobFailures: (input) => failures.run(input),
    logsSearch: (input) => logs.run(input),
    dbSchema: (input) => database.schema.run(input),
    dbQuery: (input) => database.query.run(input),
  } as InvestigationExecutors;
  const tools = buildInvestigationTools(executors, NO_DELEGATION);
  return ToolRegistry.create(
    [new NativeToolSource(tools)],
    tools.map((tool) => tool.name),
    { allowPaidWorkTools: true },
  );
};

const healthy = (): Executors => ({
  logs: logsFor({ lines: REPEATED_LINES, limitReached: false }),
  failures: failuresFor(FAILURE_ROWS),
  metrics: metricsFor('full'),
  database: explorerExecutorsFor(QUERY_ROWS),
});

const call = async (executors: Executors, name: string, input: unknown) => {
  const registry = await registryFor(executors);
  const { content, isError } = await registry.execute(
    { id: 'call-1', name, input },
    { runId: 'run-1' },
  );
  return { isError, content };
};

const lokiAdapterAnswering = (status: number): GrafanaLokiLogsAdapter =>
  new GrafanaLokiLogsAdapter(
    { baseUrl: 'https://loki.example.invalid', user: '1', token: 'token' },
    async () => new Response('{}', { status }),
  );

describe('Veronica ops tools, golden outputs', () => {
  it('offers the ten tools in this order with these exact definitions', async () => {
    const registry = await registryFor(healthy());

    expect(registry.definitions()).toMatchSnapshot();
  });

  describe('logs_search', () => {
    it.each([
      ['grouped by default', { service: 'ratingo-worker' }],
      [
        'lines with filters',
        {
          service: 'ratingo-worker',
          mode: 'lines',
          level: 'warn',
          text: 'timeout',
          queue: 'ingestion',
        },
      ],
      ['an exact job id', { service: 'ratingo-api', job_id: 'sync-show:3100', window: '7d' }],
    ])('%s', async (_name, input) => {
      expect(await call(healthy(), 'logs_search', input)).toMatchSnapshot();
    });

    it('says when the read stopped at the limit', async () => {
      const executors = {
        ...healthy(),
        logs: logsFor({ lines: REPEATED_LINES, limitReached: true }),
      };

      expect(await call(executors, 'logs_search', { service: 'ratingo-worker' })).toMatchSnapshot();
    });

    it('says nothing matched', async () => {
      const executors = { ...healthy(), logs: logsFor({ lines: [], limitReached: false }) };

      expect(await call(executors, 'logs_search', { service: 'ratingo-worker' })).toMatchSnapshot();
    });

    it('cuts a long answer by whole rows in both modes', async () => {
      const executors = { ...healthy(), logs: logsFor({ lines: MANY_LINES, limitReached: true }) };

      expect([
        await call(executors, 'logs_search', { service: 'ratingo-worker' }),
        await call(executors, 'logs_search', { service: 'ratingo-worker', mode: 'lines' }),
      ]).toMatchSnapshot();
    });

    it('refuses bad input with the exact words', async () => {
      expect([
        await call(healthy(), 'logs_search', { service: 'unknown-service' }),
        await call(healthy(), 'logs_search', {}),
        await call(healthy(), 'logs_search', { service: 'ratingo-api', window: '30d' }),
        await call(healthy(), 'logs_search', { service: 'ratingo-api', text: 'a|b{' }),
        await call(healthy(), 'logs_search', { service: 'ratingo-api', job_id: 'bad id!' }),
      ]).toMatchSnapshot();
    });

    it('reports itself unavailable, with the reason, when it is not configured', async () => {
      const executors = {
        ...healthy(),
        logs: new LogsSearchExecutor(new UnconfiguredLogsAdapter(), new FixedClock(NOW_MS), QUIET),
      };

      expect(await call(executors, 'logs_search', { service: 'ratingo-api' })).toMatchSnapshot();
    });

    it.each([400, 401, 429, 500, 404])('names the reason when Loki answers %s', async (status) => {
      const executors = {
        ...healthy(),
        logs: new LogsSearchExecutor(lokiAdapterAnswering(status), new FixedClock(NOW_MS), QUIET),
      };

      expect(await call(executors, 'logs_search', { service: 'ratingo-api' })).toMatchSnapshot();
    });

    it('reports an unexpected failure as unavailable for another reason', async () => {
      const executors = { ...healthy(), logs: logsFor(new Error('socket hang up')) };

      expect(await call(executors, 'logs_search', { service: 'ratingo-api' })).toMatchSnapshot();
    });
  });

  describe('job_failures', () => {
    it.each([
      ['no filter', {}],
      ['a job and a window', { job: 'trending', window: '48h' }],
      ['a queue', { queue: 'ingestion', window: '7d' }],
    ])('lists rows with %s', async (_name, input) => {
      expect(await call(healthy(), 'job_failures', input)).toMatchSnapshot();
    });

    it('says what an empty list does and does not mean, with and without a filter', async () => {
      const executors = { ...healthy(), failures: failuresFor([]) };

      expect([
        await call(executors, 'job_failures', {}),
        await call(executors, 'job_failures', { job: 'tracked-shows', queue: 'ingestion' }),
      ]).toMatchSnapshot();
    });

    it('cuts a long list by whole rows and names how to narrow it', async () => {
      const executors = { ...healthy(), failures: failuresFor(MANY_FAILURES) };

      expect(await call(executors, 'job_failures', {})).toMatchSnapshot();
    });

    it('refuses bad input with the exact words', async () => {
      expect([
        await call(healthy(), 'job_failures', { window: 'forever' }),
        await call(healthy(), 'job_failures', { job: 'Bad Job!' }),
        await call(healthy(), 'job_failures', { queue: 'Bad Queue' }),
        await call(healthy(), 'job_failures', { window: 5 }),
      ]).toMatchSnapshot();
    });

    it('reports itself unavailable, with the reason, when it is not configured', async () => {
      const executors = {
        ...healthy(),
        failures: new JobFailuresExecutor(
          new UnconfiguredJobFailuresAdapter(),
          new FixedClock(NOW_MS),
          QUIET,
        ),
      };

      expect(await call(executors, 'job_failures', {})).toMatchSnapshot();
    });

    it('reports the failure of the query as unavailable', async () => {
      const executors = {
        ...healthy(),
        failures: failuresFor(new JobFailuresUnavailableError('query failed (Error)')),
      };

      expect(await call(executors, 'job_failures', {})).toMatchSnapshot();
    });
  });

  describe('db_schema', () => {
    it.each([
      ['lists every readable table compactly', {}],
      ['lists the tables that match a name with column types', { table: 'saved' }],
      ['says that a name matched nothing', { table: 'payments' }],
    ])('%s', async (_name, input) => {
      expect(await call(healthy(), 'db_schema', input)).toMatchSnapshot();
    });

    it('refuses a bad table filter with the exact words', async () => {
      expect(await call(healthy(), 'db_schema', { table: 'users; drop' })).toMatchSnapshot();
    });

    it('reports itself unavailable, with the reason, when it is not configured', async () => {
      const executors = {
        ...healthy(),
        database: explorerExecutorsFor(new ExplorerNotConfiguredError()),
      };

      expect(await call(executors, 'db_schema', {})).toMatchSnapshot();
    });

    it('reports the failure of the connection as unavailable', async () => {
      const executors = {
        ...healthy(),
        database: explorerExecutorsFor(new ExplorerFailureError('network')),
      };

      expect(await call(executors, 'db_schema', {})).toMatchSnapshot();
    });
  });

  describe('db_query', () => {
    it('returns rows inside an untrusted block', async () => {
      expect(
        await call(healthy(), 'db_query', { sql: 'SELECT title, saves FROM top_saved' }),
      ).toMatchSnapshot();
    });

    it('returns the plan without running the query', async () => {
      const executors = {
        ...healthy(),
        database: explorerExecutorsFor({
          columns: ['QUERY PLAN'],
          rows: [{ 'QUERY PLAN': 'Seq Scan on users  (cost=0.00..1.06 rows=6 width=16)' }],
          hasMoreRows: false,
        }),
      };

      expect(
        await call(executors, 'db_query', { sql: 'SELECT * FROM users', explain: true }),
      ).toMatchSnapshot();
    });

    it('says what an empty answer does and does not cover', async () => {
      const executors = {
        ...healthy(),
        database: explorerExecutorsFor({ columns: ['n'], rows: [], hasMoreRows: false }),
      };

      expect(
        await call(executors, 'db_query', { sql: 'SELECT 1 AS n WHERE false' }),
      ).toMatchSnapshot();
    });

    it('says that more rows exist, as a lower bound, when the row limit is reached', async () => {
      const executors = { ...healthy(), database: explorerExecutorsFor(MANY_QUERY_ROWS) };

      expect(await call(executors, 'db_query', { sql: 'SELECT n, text FROM t' })).toMatchSnapshot();
    });

    it.each([
      [QueryRefusal.PRIVATE, 'permission denied for table users'],
      [QueryRefusal.NOT_FOUND, 'relation "payments" does not exist'],
      [QueryRefusal.INVALID_QUERY, 'syntax error at or near "FORM"'],
      [QueryRefusal.TIMEOUT, 'canceling statement due to statement timeout'],
      [QueryRefusal.BUSY, 'too many connections for role "ai_explorer"'],
    ])('answers a %s refusal from the database with its status', async (refusal, detail) => {
      const executors = {
        ...healthy(),
        database: explorerExecutorsFor(new ExplorerQueryRefusedError(refusal, detail)),
      };

      expect(await call(executors, 'db_query', { sql: 'SELECT 1' })).toMatchSnapshot();
    });

    it('reports itself unavailable, with the reason, when it is not configured', async () => {
      const executors = {
        ...healthy(),
        database: explorerExecutorsFor(new ExplorerNotConfiguredError()),
      };

      expect(await call(executors, 'db_query', { sql: 'SELECT 1' })).toMatchSnapshot();
    });

    it('reports the failure of the connection as unavailable', async () => {
      const executors = {
        ...healthy(),
        database: explorerExecutorsFor(new ExplorerFailureError('network')),
      };

      expect(await call(executors, 'db_query', { sql: 'SELECT 1' })).toMatchSnapshot();
    });

    it.each([
      ['a second statement', 'SELECT 1; SELECT 2'],
      ['a write', 'DELETE FROM users'],
      ['a data-changing cte', 'WITH x AS (DELETE FROM genres RETURNING 1) SELECT * FROM x'],
      ['an empty statement', '  '],
    ])('refuses %s with the exact words', async (_name, sql) => {
      expect(await call(healthy(), 'db_query', { sql })).toMatchSnapshot();
    });
  });

  describe('metrics_query', () => {
    it.each(Object.values(MetricTemplateName))(
      '%s with its default parameters',
      async (template) => {
        expect(await call(healthy(), 'metrics_query', { template })).toMatchSnapshot();
      },
    );

    it.each([
      ['a queue and a window', { template: 'queue_throughput', queue: 'ingestion', window: '6h' }],
      ['a shifted day', { template: 'queue_backlog_peak', offset_days: 7 }],
      [
        'a provider and a status',
        {
          template: 'http_client_errors',
          provider: 'api.themoviedb.org',
          status: '429',
          window: '7d',
        },
      ],
      ['one job', { template: 'scheduler_last_runs', job: 'job-weekly' }],
      ['a job the schedule does not have', { template: 'scheduler_last_runs', job: 'refresh-all' }],
    ])('answers %s', async (_name, input) => {
      expect(await call(healthy(), 'metrics_query', input)).toMatchSnapshot();
    });

    it('says when Prometheus has no data', async () => {
      const executors = { ...healthy(), metrics: metricsFor('none') };

      expect(
        await Promise.all(
          Object.values(MetricTemplateName).map((template) =>
            call(executors, 'metrics_query', { template }),
          ),
        ),
      ).toMatchSnapshot();
    });

    it('refuses bad parameters with the exact words', async () => {
      expect([
        await call(healthy(), 'metrics_query', { template: 'no_such_template' }),
        await call(healthy(), 'metrics_query', {
          template: 'queue_throughput',
          queue: 'Bad Queue',
        }),
        await call(healthy(), 'metrics_query', { template: 'queue_throughput', window: '30d' }),
        await call(healthy(), 'metrics_query', { template: 'infra_health', window: '6h' }),
        await call(healthy(), 'metrics_query', { template: 'http_client_errors', status: '999' }),
        await call(healthy(), 'metrics_query', { template: 'queue_throughput', offset_days: 99 }),
      ]).toMatchSnapshot();
    });

    it('reports a failed query with its message', async () => {
      const executors = {
        ...healthy(),
        metrics: metricsFor(new Error('Grafana відповіла HTTP 502')),
      };

      expect(
        await call(executors, 'metrics_query', { template: 'infra_health' }),
      ).toMatchSnapshot();
    });

    it('reports itself unavailable, with the reason, when Grafana is not configured', async () => {
      const executors = {
        ...healthy(),
        metrics: new MetricsQueryExecutor(
          new PrometheusMetricsAdapter({ baseUrl: undefined, token: undefined }),
          new FixedClock(NOW_MS),
          QUIET,
        ),
      };

      expect(
        await call(executors, 'metrics_query', { template: 'infra_health' }),
      ).toMatchSnapshot();
    });

    it.each([401, 429, 503])('names the status when Grafana answers %s', async (status) => {
      const executors = {
        ...healthy(),
        metrics: new MetricsQueryExecutor(
          new PrometheusMetricsAdapter(
            { baseUrl: 'https://prom.example.invalid', token: 'token' },
            async () => new Response('{}', { status }),
          ),
          new FixedClock(NOW_MS),
          QUIET,
        ),
      };

      expect(
        await call(executors, 'metrics_query', { template: 'infra_health' }),
      ).toMatchSnapshot();
    });
  });

  it('keeps the system card text, with every shape of schedule described the same way', () => {
    expect(renderSystemCard(FIXTURE_CARD)).toMatchSnapshot();
  });

  it('renders the live system card within its share of the prompt', () => {
    expect(renderSystemCard(SYSTEM_CARD).length).toBeLessThanOrEqual(SYSTEM_CARD_MAX_CHARS);
  });
});
