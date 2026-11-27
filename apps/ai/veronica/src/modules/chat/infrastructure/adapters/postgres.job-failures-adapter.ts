import type { OnApplicationShutdown } from '@nestjs/common';

import { PostgresJobFailuresAdapter as ReportingJobFailuresAdapter } from '@ratingo/ai-ops-tools';

export class PostgresJobFailuresAdapter
  extends ReportingJobFailuresAdapter
  implements OnApplicationShutdown
{
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
