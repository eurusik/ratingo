import type postgres from 'postgres';

import { JOB_FAILURES_ROW_LIMIT } from './job-failures.constants';
import {
  JobFailuresUnavailableError,
  type JobFailureFilter,
  type JobFailureSummary,
  type JobFailuresPort,
} from './job-failures.port';
import { connectReportingDatabase } from './reporting-connection';

const READER_CONNECTIONS = 1;
const MS_PER_SECOND = 1000;
const SHUTDOWN_GRACE_SECONDS = 5;

interface JobFailureRow {
  job: string;
  job_type: string;
  queue: string;
  error_class: string;
  failures: number;
  exhausted: number;
  first_failed_ms: number;
  last_failed_ms: number;
  last_message: string;
}

const toSummary = (row: JobFailureRow): JobFailureSummary => ({
  job: row.job,
  jobType: row.job_type,
  queue: row.queue,
  errorClass: row.error_class,
  failures: row.failures,
  attemptsExhausted: row.exhausted,
  firstFailedAtMs: row.first_failed_ms,
  lastFailedAtMs: row.last_failed_ms,
  lastMessage: row.last_message,
});

const failureReason = (error: unknown): string =>
  error instanceof Error ? `query failed (${error.name})` : 'query failed';

export class PostgresJobFailuresAdapter implements JobFailuresPort {
  static connect<T extends PostgresJobFailuresAdapter>(
    this: new (sql: postgres.Sql) => T,
    readerDatabaseUrl: string,
  ): T {
    return new this(connectReportingDatabase(readerDatabaseUrl, READER_CONNECTIONS));
  }

  constructor(private readonly sql: postgres.Sql) {}

  async since(filter: JobFailureFilter): Promise<JobFailureSummary[]> {
    try {
      const rows = await this.query(filter);
      return rows.map(toSummary);
    } catch (error) {
      throw new JobFailuresUnavailableError(failureReason(error));
    }
  }

  private query(filter: JobFailureFilter): Promise<JobFailureRow[]> {
    return this.sql<JobFailureRow[]>`
      SELECT
        coalesce(scheduler_job_id, job_type) AS job,
        job_type,
        queue,
        error_class,
        sum(failure_count)::integer AS failures,
        sum(exhausted_count)::integer AS exhausted,
        (extract(epoch FROM min(first_failed_at)) * ${MS_PER_SECOND})::float8 AS first_failed_ms,
        (extract(epoch FROM max(last_failed_at)) * ${MS_PER_SECOND})::float8 AS last_failed_ms,
        (array_agg(last_message ORDER BY last_failed_at DESC))[1] AS last_message
      FROM reporting.daily_job_failures
      WHERE day BETWEEN ${filter.firstKyivDay}::date AND ${filter.lastKyivDay}::date
        ${this.jobNameFilter(filter.job)}
        ${this.queueFilter(filter.queue)}
      GROUP BY 1, 2, 3, 4
      ORDER BY failures DESC, last_failed_ms DESC, job
      LIMIT ${JOB_FAILURES_ROW_LIMIT}`;
  }

  private jobNameFilter(job: string | undefined): postgres.PendingQuery<postgres.Row[]> {
    if (job === undefined) return this.sql``;
    const inJobType = this.sql`strpos(job_type, ${job}) > 0`;
    const inSchedulerId = this.sql`strpos(coalesce(scheduler_job_id, ''), ${job}) > 0`;
    return this.sql`AND (${inJobType} OR ${inSchedulerId})`;
  }

  private queueFilter(queue: string | undefined): postgres.PendingQuery<postgres.Row[]> {
    return queue === undefined ? this.sql`` : this.sql`AND queue = ${queue}`;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: SHUTDOWN_GRACE_SECONDS });
  }
}
