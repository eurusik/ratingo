import { Module } from '@nestjs/common';

import { JobFailureRecorder } from './application/services/job-failure-recorder.service';
import { JOB_FAILURE_SUMMARY_REPOSITORY } from './domain/repositories/job-failure-summary.repository';
import { DrizzleJobFailureSummaryRepository } from './infrastructure/repositories/drizzle-job-failure-summary.repository';

@Module({
  providers: [
    { provide: JOB_FAILURE_SUMMARY_REPOSITORY, useClass: DrizzleJobFailureSummaryRepository },
    JobFailureRecorder,
  ],
  exports: [JobFailureRecorder],
})
export class JobFailuresModule {}
