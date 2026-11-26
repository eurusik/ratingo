import { Inject, Injectable, Logger } from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { JOB_FAILURE_DAY_TIME_ZONE } from '@/modules/job-failures/domain/constants/job-failure.constants';
import { type JobFailure } from '@/modules/job-failures/domain/entities/job-failure.entity';
import { type JobFailureSummaryRepository } from '@/modules/job-failures/domain/repositories/job-failure-summary.repository';

const { jobFailureDays } = schema;

const dayOf = (instant: Date) =>
  sql`(${instant.toISOString()}::timestamptz AT TIME ZONE ${JOB_FAILURE_DAY_TIME_ZONE})::date`;

@Injectable()
export class DrizzleJobFailureSummaryRepository implements JobFailureSummaryRepository {
  private readonly logger = new Logger(DrizzleJobFailureSummaryRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async recordFailure(failure: JobFailure): Promise<void> {
    return withDbError(
      'record job failure',
      this.logger,
      async () => {
        await this.db
          .insert(jobFailureDays)
          .values({
            day: dayOf(failure.failedAt),
            queue: failure.queue,
            jobType: failure.jobType,
            schedulerJobId: failure.schedulerJobId,
            errorClass: failure.errorClass,
            failureCount: 1,
            exhaustedCount: failure.attemptsExhausted ? 1 : 0,
            firstFailedAt: failure.failedAt,
            lastFailedAt: failure.failedAt,
            lastMessage: failure.message,
          })
          .onConflictDoUpdate({
            target: [
              jobFailureDays.day,
              jobFailureDays.queue,
              jobFailureDays.jobType,
              jobFailureDays.schedulerJobId,
              jobFailureDays.errorClass,
            ],
            set: {
              failureCount: sql`${jobFailureDays.failureCount} + 1`,
              exhaustedCount: sql`${jobFailureDays.exhaustedCount} + excluded.exhausted_count`,
              firstFailedAt: sql`least(${jobFailureDays.firstFailedAt}, excluded.first_failed_at)`,
              lastFailedAt: sql`greatest(${jobFailureDays.lastFailedAt}, excluded.last_failed_at)`,
              lastMessage: sql`CASE WHEN excluded.last_failed_at >= ${jobFailureDays.lastFailedAt} THEN excluded.last_message ELSE ${jobFailureDays.lastMessage} END`,
            },
          });
      },
      { queue: failure.queue, jobType: failure.jobType, errorClass: failure.errorClass },
    );
  }

  async deleteDaysBefore(cutoff: Date): Promise<number> {
    return withDbError('prune job failure days', this.logger, async () => {
      const deleted = await this.db
        .delete(jobFailureDays)
        .where(sql`${jobFailureDays.day} < ${dayOf(cutoff)}`)
        .returning({ id: jobFailureDays.id });
      return deleted.length;
    });
  }
}
