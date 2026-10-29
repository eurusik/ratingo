import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { HEALTH_QUEUE } from './health.constants';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [BullModule.registerQueue({ name: HEALTH_QUEUE })],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
