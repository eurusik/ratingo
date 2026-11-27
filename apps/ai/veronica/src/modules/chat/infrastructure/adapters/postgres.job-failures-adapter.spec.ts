import postgres from 'postgres';

import { JobFailuresUnavailableError, kyivDateOf } from '@ratingo/ai-ops-tools';

import { describeWithDatabase, TEST_DATABASE_URL } from '../../../../testing/test-database.testing';

import { PostgresJobFailuresAdapter } from './postgres.job-failures-adapter';

const READER_LOGIN = 'ai_reader_job_failures_test';
const READER_PASSWORD = 'contract-test';
const SEED_QUEUE = 'veronica-contract';
const HOUR_MS = 3_600_000;

const readerUrl = (): string => {
  const url = new URL(TEST_DATABASE_URL as string);
  url.username = READER_LOGIN;
  url.password = READER_PASSWORD;
  return url.toString();
};

describeWithDatabase('PostgresJobFailuresAdapter against reporting.daily_job_failures', () => {
  let admin: postgres.Sql;
  let adapter: PostgresJobFailuresAdapter;
  let nowMs: number;

  const iso = (ms: number): string => new Date(ms).toISOString();
  const kyivDays = (fromHoursAgo: number) => ({
    firstKyivDay: kyivDateOf(nowMs - fromHoursAgo * HOUR_MS),
    lastKyivDay: kyivDateOf(nowMs),
  });

  const seed = (row: {
    hoursAgo: number;
    jobType: string;
    schedulerJobId: string | null;
    errorClass: string;
    failures: number;
    exhausted: number;
    message: string;
  }) => {
    const at = iso(nowMs - row.hoursAgo * HOUR_MS);
    return admin`
      INSERT INTO job_failure_days (day, queue, job_type, scheduler_job_id, error_class,
        failure_count, exhausted_count, first_failed_at, last_failed_at, last_message)
      VALUES ((${at}::timestamptz AT TIME ZONE 'Europe/Kyiv')::date, ${SEED_QUEUE}, ${row.jobType},
        ${row.schedulerJobId}, ${row.errorClass}, ${row.failures}, ${row.exhausted}, ${at}, ${at},
        ${row.message})`;
  };

  beforeAll(async () => {
    admin = postgres(TEST_DATABASE_URL as string);
    await admin.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${READER_LOGIN}') THEN
          CREATE ROLE ${READER_LOGIN} LOGIN PASSWORD '${READER_PASSWORD}' IN ROLE ai_reader;
        END IF;
      END
      $$`);
    adapter = PostgresJobFailuresAdapter.connect(readerUrl());
  });

  beforeEach(async () => {
    nowMs = Date.now();
    await admin`DELETE FROM job_failure_days WHERE queue = ${SEED_QUEUE}`;
  });

  afterAll(async () => {
    await admin`DELETE FROM job_failure_days WHERE queue = ${SEED_QUEUE}`;
    await adapter.onApplicationShutdown();
    await admin.unsafe(`DROP OWNED BY ${READER_LOGIN}`);
    await admin.unsafe(`DROP ROLE ${READER_LOGIN}`);
    await admin.end();
  });

  it('groups by job, queue and class and keeps the newest message', async () => {
    await seed({
      hoursAgo: 30,
      jobType: 'sync-trending-dispatcher',
      schedulerJobId: 'scheduled-trending',
      errorClass: 'rate_limit',
      failures: 4,
      exhausted: 1,
      message: 'older',
    });
    await seed({
      hoursAgo: 2,
      jobType: 'sync-trending-dispatcher',
      schedulerJobId: 'scheduled-trending',
      errorClass: 'rate_limit',
      failures: 6,
      exhausted: 2,
      message: 'Trakt API: 429 Too Many Requests',
    });
    await seed({
      hoursAgo: 1,
      jobType: 'sync-show',
      schedulerJobId: null,
      errorClass: 'not_found',
      failures: 1,
      exhausted: 1,
      message: 'TMDB API: Resource not found',
    });

    const rows = await adapter.since({ ...kyivDays(72), queue: SEED_QUEUE });

    expect(rows).toEqual([
      {
        job: 'scheduled-trending',
        jobType: 'sync-trending-dispatcher',
        queue: SEED_QUEUE,
        errorClass: 'rate_limit',
        failures: 10,
        attemptsExhausted: 3,
        firstFailedAtMs: nowMs - 30 * HOUR_MS,
        lastFailedAtMs: nowMs - 2 * HOUR_MS,
        lastMessage: 'Trakt API: 429 Too Many Requests',
      },
      expect.objectContaining({ job: 'sync-show', jobType: 'sync-show', failures: 1 }),
    ]);
  });

  it('filters by part of a job name and by Kyiv days', async () => {
    await seed({
      hoursAgo: 1,
      jobType: 'sync-show',
      schedulerJobId: null,
      errorClass: 'timeout',
      failures: 2,
      exhausted: 0,
      message: 'Request timeout',
    });
    await seed({
      hoursAgo: 50,
      jobType: 'sync-movie',
      schedulerJobId: null,
      errorClass: 'network',
      failures: 3,
      exhausted: 3,
      message: 'fetch failed',
    });

    await expect(
      adapter.since({ ...kyivDays(1), queue: SEED_QUEUE, job: 'movie' }),
    ).resolves.toEqual([]);
    await expect(
      adapter.since({ ...kyivDays(72), queue: SEED_QUEUE, job: 'movie' }),
    ).resolves.toEqual([expect.objectContaining({ job: 'sync-movie', failures: 3 })]);
  });

  it('reports itself unavailable when the query fails', async () => {
    const broken = new PostgresJobFailuresAdapter(
      postgres('postgres://nobody:wrong@127.0.0.1:1/none', { connect_timeout: 1 }),
    );

    await expect(broken.since(kyivDays(1))).rejects.toBeInstanceOf(JobFailuresUnavailableError);
    await broken.onApplicationShutdown();
  });
});
