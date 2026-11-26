import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '@/database/database.module';
import { ClockModule } from '@/modules/shared/clock';

import { JobFailuresModule } from './job-failures.module';
import { JobFailureRecorder } from './public';

@Global()
@Module({
  providers: [{ provide: DATABASE_CONNECTION, useValue: {} }],
  exports: [DATABASE_CONNECTION],
})
class FakeDatabaseModule {}

describe('JobFailuresModule', () => {
  it('resolves the recorder from the global database and clock', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, ClockModule, JobFailuresModule],
    }).compile();

    expect(moduleRef.get(JobFailureRecorder)).toBeInstanceOf(JobFailureRecorder);
    await moduleRef.close();
  });
});
