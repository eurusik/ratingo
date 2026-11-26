import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { JOB_FAILURE_CLASSES } from '@/modules/job-failures/public';

const errorClassList = sql.raw(JOB_FAILURE_CLASSES.map((value) => `'${value}'`).join(', '));

export const jobFailureDays = pgTable(
  'job_failure_days',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    day: date('day').notNull(),
    queue: text('queue').notNull(),
    jobType: text('job_type').notNull(),
    schedulerJobId: text('scheduler_job_id'),
    errorClass: text('error_class').notNull(),
    failureCount: integer('failure_count').notNull(),
    exhaustedCount: integer('exhausted_count').notNull(),
    firstFailedAt: timestamp('first_failed_at', { withTimezone: true }).notNull(),
    lastFailedAt: timestamp('last_failed_at', { withTimezone: true }).notNull(),
    lastMessage: text('last_message').notNull(),
  },
  (t) => [
    unique('job_failure_days_key_unique')
      .on(t.day, t.queue, t.jobType, t.schedulerJobId, t.errorClass)
      .nullsNotDistinct(),
    check('job_failure_days_error_class_check', sql`${t.errorClass} IN (${errorClassList})`),
    check(
      'job_failure_days_counts_check',
      sql`${t.failureCount} >= 1 AND ${t.exhaustedCount} >= 0 AND ${t.exhaustedCount} <= ${t.failureCount}`,
    ),
  ],
);
