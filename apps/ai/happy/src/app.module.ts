import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { AiCoreModule } from './core/ai-core.module';
import { HealthModule } from './health/health.module';
import { ReviewModule } from './modules/review/public';

@Module({
  imports: [ConfigModule.forService(process.env), AiCoreModule, ReviewModule, HealthModule],
})
export class AppModule {}
