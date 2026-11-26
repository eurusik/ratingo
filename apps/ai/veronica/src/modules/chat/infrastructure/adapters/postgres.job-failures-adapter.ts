import type { OnApplicationShutdown } from '@nestjs/common';

import type postgres from 'postgres';

import { connectReportingDatabase } from '../../../../database/reporting-connection';
import { JOB_FAILURES_ROW_LIMIT } from '../../domain/constants/investigation.constants';
import {
  JobFailuresUnavailableError,
  type JobFailureFilter,
  type JobFailureSummary,
  type JobFailuresPort,
} from '../../domain/ports/job-failures.port';

const READER_CONNECTIONS = 1;
const MS_PER_SECOND = 1000;

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

export class PostgresJobFailuresAdapter implements JobFailuresPort, OnApplicationShutdown {
  static connect(readerDatabaseUrl: string): PostgresJobFailuresAdapter {
    return new PostgresJobFailuresAdapter(
      connectReportingDatabase(readerDatabaseUrl, READER_CONNECTIONS),
    );
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
    const jobFilter =
      filter.job === undefined
        ? this.sql``
        : this
            .sql`AND (strpos(job_type, ${filter.job}) > 0 OR strpos(coalesce(scheduler_job_id, ''), ${filter.job}) > 0)`;
    const queueFilter =
      filter.queue === undefined ? this.sql`` : this.sql`AND queue = ${filter.queue}`;
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
      WHERE last_failed_at >= to_timestamp(${filter.sinceMs / MS_PER_SECOND})
        ${jobFilter}
        ${queueFilter}
      GROUP BY 1, 2, 3, 4
      ORDER BY failures DESC, last_failed_ms DESC, job
      LIMIT ${JOB_FAILURES_ROW_LIMIT}`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.sql.end();
  }
}
