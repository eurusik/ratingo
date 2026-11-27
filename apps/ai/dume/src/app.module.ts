import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { AiCoreModule } from './core/ai-core.module';
import { HealthModule } from './health/health.module';
import { InvestigationRequestsModule } from './modules/investigation-requests/public';

@Module({
  imports: [
    ConfigModule.forService(process.env),
    AiCoreModule,
    InvestigationRequestsModule,
    HealthModule,
  ],
})
export class AppModule {}
