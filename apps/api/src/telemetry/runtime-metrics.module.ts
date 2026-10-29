import { Module } from '@nestjs/common';

import { RuntimeMetricsService } from './runtime-metrics.service';

@Module({
  providers: [RuntimeMetricsService],
})
export class RuntimeMetricsModule {}
