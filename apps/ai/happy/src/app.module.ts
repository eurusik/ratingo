import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { AiCoreModule } from './core/ai-core.module';
import { HealthModule } from './health/health.module';
import { ReviewModule } from './modules/review/public';
import { WebhookModule } from './modules/webhook/public';

@Module({
  imports: [ConfigModule.forService(process.env), AiCoreModule, ReviewModule, WebhookModule, HealthModule],
})
export class AppModule {}
