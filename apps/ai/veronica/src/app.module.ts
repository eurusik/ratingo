import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { AiCoreModule } from './core/ai-core.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LandingModule } from './landing/landing.module';
import { DigestScheduleModule } from './modules/digest/public';
import { RunsModule } from './modules/runs/public';

@Module({
  imports: [
    ConfigModule.forService(process.env),
    DatabaseModule,
    RunsModule.postgres(),
    AiCoreModule,
    DigestScheduleModule,
    HealthModule,
    LandingModule,
  ],
})
export class AppModule {}
