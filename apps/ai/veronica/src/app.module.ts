import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { AiCoreModule } from './core/ai-core.module';
import { McpModule } from './core/mcp/mcp.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LandingModule } from './landing/landing.module';
import { ChatModule } from './modules/chat/public';
import { DigestScheduleModule } from './modules/digest/public';
import { RunsModule } from './modules/runs/public';
import { WatchdogModule } from './modules/watchdog/public';

@Module({
  imports: [
    ConfigModule.forService(process.env),
    DatabaseModule,
    RunsModule.postgres(),
    AiCoreModule,
    McpModule,
    DigestScheduleModule,
    ChatModule,
    WatchdogModule,
    HealthModule,
    LandingModule,
  ],
})
export class AppModule {}
