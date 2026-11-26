import { Inject, Injectable, Logger } from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { type JobFailureTally } from '@/modules/job-failures/domain/entities/job-failure-tally.entity';
import { failuresIn } from '@/modules/job-failures/domain/policies/job-failure-tally.policy';
import { type JobFailureSummaryRepository } from '@/modules/job-failures/domain/repositories/job-failure-summary.repository';

const { jobFailureDays } = schema;

const toRow = (tally: JobFailureTally): typeof jobFailureDays.$inferInsert => ({
  day: tally.day,
  queue: tally.queue,
  jobType: tally.jobType,
  schedulerJobId: tally.schedulerJobId,
  errorClass: tally.errorClass,
  failureCount: tally.failureCount,
  exhaustedCount: tally.exhaustedCount,
  firstFailedAt: new Date(tally.firstFailedAtMs),
  lastFailedAt: new Date(tally.lastFailedAtMs),
  lastMessage: tally.lastMessage,
});

@Injectable()
export class DrizzleJobFailureSummaryRepository implements JobFailureSummaryRepository {
  private readonly logger = new Logger(DrizzleJobFailureSummaryRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async addTallies(tallies: readonly JobFailureTally[]): Promise<void> {
    if (tallies.length === 0) return;
    return withDbError(
      'add job failure tallies',
      this.logger,
      async () => {
        await this.db
          .insert(jobFailureDays)
          .values(tallies.map(toRow))
          .onConflictDoUpdate({
            target: [
              jobFailureDays.day,
              jobFailureDays.queue,
              jobFailureDays.jobType,
              jobFailureDays.schedulerJobId,
              jobFailureDays.errorClass,
            ],
            set: {
              failureCount: sql`${jobFailureDays.failureCount} + excluded.failure_count`,
              exhaustedCount: sql`${jobFailureDays.exhaustedCount} + excluded.exhausted_count`,
              firstFailedAt: sql`least(${jobFailureDays.firstFailedAt}, excluded.first_failed_at)`,
              lastFailedAt: sql`greatest(${jobFailureDays.lastFailedAt}, excluded.last_failed_at)`,
              lastMessage: sql`CASE WHEN excluded.last_failed_at >= ${jobFailureDays.lastFailedAt} THEN excluded.last_message ELSE ${jobFailureDays.lastMessage} END`,
            },
          });
      },
      {
        rows: tallies.length,
        failures: failuresIn(tallies),
      },
    );
  }

  async deleteDaysOlderThan(kyivToday: string, keptDays: number): Promise<number> {
    return withDbError('prune job failure days', this.logger, async () => {
      const deleted = await this.db
        .delete(jobFailureDays)
        .where(sql`${jobFailureDays.day} < ${kyivToday}::date - ${keptDays - 1}::integer`)
        .returning({ id: jobFailureDays.id });
      return deleted.length;
    });
  }
}
